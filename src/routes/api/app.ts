import { createFileRoute } from "@tanstack/react-router";
import { isTrustedAppOrigin } from "@/lib/auth/isolation.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { addTagFor, listTagsFor } from "@/lib/server/catalog";
import { clientIp, rateLimit, sweepRateBuckets } from "@/lib/server/rate-limit";
import {
  getProfileForViewerUser,
  listDeckForUser,
  listDiscoverForUser,
  swipeFor,
  undoSwipeFor,
} from "@/lib/server/profiles";
import {
  blockUserFor,
  listBlocksFor,
  reportUserFor,
  unblockUserFor,
} from "@/lib/server/safety";
import {
  createPostFor,
  listFeedFor,
  listLikesFor,
  toggleFollowFor,
  toggleLikeFor,
  togglePostLikeFor,
} from "@/lib/server/social";
import { claimServeFor, decideServeFor, gloryFor, releaseLockFor, startLockFor } from "@/lib/server/glory.server";

/**
 * Per-user ceilings for the deck endpoints.
 *
 * Discover and swipe were previously unmetered. Left that way, any signed-in
 * account can walk the keyset cursor and enumerate the entire member table —
 * every handle, bio, photo URL, identity set and distance. For most apps that
 * is a scraping nuisance; here it is a doxxing and extortion tool aimed at an
 * audience that can least afford it, so the deck is rationed like a paid
 * resource, not a free one.
 */
const DECK_PER_HOUR = 400;
const SWIPE_PER_HOUR = 1200;
const MUTATION_PER_HOUR = 300;
const POST_PER_HOUR = 30;

export const Route = createFileRoute("/api/app")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          sweepRateBuckets();
          if (!isTrustedAppOrigin(request)) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
          const body = (await request.json()) as Record<string, unknown> & {
            op?: string;
          };
          const op = String(body.op ?? "");
          if (op === "tags") {
            const data = await listTagsFor(String(body.kind ?? ""));
            return Response.json({ data }, { headers: { "cache-control": "no-store" } });
          }
          const authUser = await getSessionUserFromRequest(request);
          if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
          const userId = authUser.id;
          const ip = clientIp(request);

          if (op === "addTag") {
            // Writing to the global tag catalog is an authenticated, rate-limited
            // action (any signed-in user can still add niche tags; they just
            // can't script or spam the catalog).
            if (!rateLimit(`add-tag:${userId}`, 10, 60 * 60 * 1000)) {
              return Response.json({ error: "Slow down." }, { status: 429 });
            }
            const data = await addTagFor(String(body.kind ?? ""), String(body.label ?? ""));
            return Response.json({ data }, { headers: { "cache-control": "no-store" } });
          }

          const limited = (key: string, limit: number) =>
            rateLimit(`${key}:${userId}`, limit, 60 * 60 * 1000);

          let data: unknown;
          switch (op) {
            case "discover":
            case "deck": {
              if (!limited("deck", DECK_PER_HOUR)) {
                return Response.json(
                  { error: "You've been browsing hard. Come back in a bit." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              const args = {
                tab: typeof body.tab === "string" ? body.tab : undefined,
                miles: typeof body.miles === "number" ? body.miles : undefined,
                lookingFor: typeof body.lookingFor === "string" ? body.lookingFor : undefined,
                role: typeof body.role === "string" ? body.role : undefined,
                ethnicity: typeof body.ethnicity === "string" ? body.ethnicity : undefined,
                q: typeof body.q === "string" ? body.q : undefined,
                cursor: typeof body.cursor === "string" ? body.cursor : undefined,
                limit: typeof body.limit === "number" ? body.limit : undefined,
              };
              data =
                op === "deck"
                  ? await listDeckForUser(userId, args)
                  : await listDiscoverForUser(userId, args);
              break;
            }
            case "swipe": {
              if (!limited("swipe", SWIPE_PER_HOUR)) {
                return Response.json(
                  { error: "Slow down a second." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              const direction =
                body.direction === "pass" ? "pass" : ("like" as "like" | "pass");
              data = await swipeFor(userId, String(body.targetId ?? ""), direction);
              break;
            }
            case "undo": {
              // Undo is a real write (it clears a decision and a like), so it is
              // metered like one — but generously, because a member second-
              // guessing a swipe should never hit a wall.
              if (!limited("swipe", SWIPE_PER_HOUR)) {
                return Response.json(
                  { error: "Slow down a second." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              data = await undoSwipeFor(userId, String(body.targetId ?? ""));
              break;
            }
            case "view":
              data = await getProfileForViewerUser(userId, String(body.handle ?? ""));
              break;
            case "like":
            case "follow":
            case "block":
            case "unblock":
            case "report": {
              if (!limited("mutate", MUTATION_PER_HOUR)) {
                return Response.json(
                  { error: "Too many actions. Try again shortly." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              if (op === "like") {
                data = await toggleLikeFor(userId, String(body.userId ?? ""));
              } else if (op === "follow") {
                data = await toggleFollowFor(userId, String(body.userId ?? ""));
              } else if (op === "block") {
                data = await blockUserFor(userId, String(body.userId ?? ""));
              } else if (op === "unblock") {
                data = await unblockUserFor(userId, String(body.userId ?? ""));
              } else {
                // Reports get their own tighter ceiling: one person filing 300
                // reports an hour is a moderation outage, not a user.
                if (!rateLimit(`report:${userId}`, 20, 60 * 60 * 1000)) {
                  return Response.json(
                    { error: "You've sent a lot of reports. Give us a moment." },
                    { status: 429, headers: { "cache-control": "no-store" } },
                  );
                }
                data = await reportUserFor(userId, {
                  targetId: String(body.userId ?? ""),
                  reason: String(body.reason ?? ""),
                  detail: typeof body.detail === "string" ? body.detail : "",
                  conversationId:
                    typeof body.conversationId === "number" ? body.conversationId : null,
                });
              }
              break;
            }
            case "blocks":
              data = await listBlocksFor(userId);
              break;
            case "likes":
              if (!limited("deck", DECK_PER_HOUR)) {
                return Response.json(
                  { error: "Too many requests. Try again shortly." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              data = await listLikesFor(userId);
              break;
            case "feed":
              data = await listFeedFor(userId, typeof body.tab === "string" ? body.tab : undefined);
              break;
            case "createPost": {
              if (!limited("post", POST_PER_HOUR)) {
                return Response.json(
                  { error: "You've posted a lot. Take a breath." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              data = await createPostFor(userId, {
                body: String(body.body ?? ""),
                photoUrl: typeof body.photoUrl === "string" ? body.photoUrl : null,
              });
              break;
            }
            case "postLike":
              if (!limited("mutate", MUTATION_PER_HOUR)) {
                return Response.json(
                  { error: "Slow down." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              data = await togglePostLikeFor(userId, Number(body.postId));
              break;
            case "glory":
              data = await gloryFor(userId);
              break;
            case "lockStart": {
              if (!limited("mutate", MUTATION_PER_HOUR)) {
                return Response.json(
                  { error: "Slow down a second." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              const pledge =
                typeof body.pledgeHours === "number" && body.pledgeHours > 0
                  ? body.pledgeHours
                  : null;
              data = await startLockFor(userId, {
                pledgeHours: pledge,
                note: typeof body.note === "string" ? body.note : null,
              });
              break;
            }
            case "serveClaim": {
              if (!limited("mutate", MUTATION_PER_HOUR)) {
                return Response.json(
                  { error: "Slow down a second." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              data = await claimServeFor(userId, String(body.bullId ?? ""));
              break;
            }
            case "serveDecide": {
              if (!limited("mutate", MUTATION_PER_HOUR)) {
                return Response.json(
                  { error: "Slow down a second." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              data = await decideServeFor(userId, Number(body.serveId), Boolean(body.approve));
              break;
            }
            case "lockRelease": {
              if (!limited("mutate", MUTATION_PER_HOUR)) {
                return Response.json(
                  { error: "Slow down a second." },
                  { status: 429, headers: { "cache-control": "no-store" } },
                );
              }
              data = await releaseLockFor(userId);
              break;
            }
            default:
              return Response.json({ error: "Unknown action." }, { status: 400 });
          }
          void ip;
          return Response.json({ data }, { headers: { "cache-control": "no-store" } });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Request failed.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
