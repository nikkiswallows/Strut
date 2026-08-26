import { createFileRoute } from "@tanstack/react-router";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import { addTagFor, listTagsFor } from "@/lib/server/catalog";
import { getProfileForViewerUser, listDiscoverForUser } from "@/lib/server/profiles";
import {
  createPostFor,
  listFeedFor,
  listLikesFor,
  toggleFollowFor,
  toggleLikeFor,
  togglePostLikeFor,
} from "@/lib/server/social";

export const Route = createFileRoute("/api/app")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown> & {
            op?: string;
            sessionToken?: string;
          };
          const op = String(body.op ?? "");
          if (op === "tags") {
            const data = await listTagsFor(String(body.kind ?? ""));
            return Response.json({ data }, { headers: { "cache-control": "no-store" } });
          }
          if (op === "addTag") {
            const data = await addTagFor(String(body.kind ?? ""), String(body.label ?? ""));
            return Response.json({ data }, { headers: { "cache-control": "no-store" } });
          }
          const userId = await userIdFromRequest(request, body.sessionToken);
          if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
          let data: unknown;
          switch (op) {
            case "discover":
              data = await listDiscoverForUser(userId, {
                tab: typeof body.tab === "string" ? body.tab : undefined,
                miles: typeof body.miles === "number" ? body.miles : undefined,
                lookingFor: typeof body.lookingFor === "string" ? body.lookingFor : undefined,
                role: typeof body.role === "string" ? body.role : undefined,
                q: typeof body.q === "string" ? body.q : undefined,
              });
              break;
            case "view":
              data = await getProfileForViewerUser(userId, String(body.handle ?? ""));
              break;
            case "like":
              data = await toggleLikeFor(userId, String(body.userId ?? ""));
              break;
            case "follow":
              data = await toggleFollowFor(userId, String(body.userId ?? ""));
              break;
            case "likes":
              data = await listLikesFor(userId);
              break;
            case "feed":
              data = await listFeedFor(userId);
              break;
            case "createPost":
              data = await createPostFor(userId, {
                body: String(body.body ?? ""),
                photoUrl: typeof body.photoUrl === "string" ? body.photoUrl : null,
              });
              break;
            case "postLike":
              data = await togglePostLikeFor(userId, Number(body.postId));
              break;
            default:
              return Response.json({ error: "Unknown action." }, { status: 400 });
          }
          return Response.json({ data }, { headers: { "cache-control": "no-store" } });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Request failed.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
