import { createFileRoute } from "@tanstack/react-router";
import { forbiddenUnlessTrustedOrigin } from "@/lib/auth/isolation.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { rateLimit, sweepRateBuckets } from "@/lib/server/rate-limit";
import {
  adminEnabled,
  approveSeedJob,
  deleteProfile,
  discardSeedJob,
  ensureAdminAccount,
  ForbiddenError,
  isAdminUser,
  listProfiles,
  listSeedJobs,
  pollSeedJob,
  purgeAiProfiles,
  retrySeedImage,
  setProfileSuspended,
  startSeedJob,
  updateSeedDraft,
} from "@/lib/server/admin.server";
import { hordeAccount, hordeImageModels } from "@/lib/server/horde.server";
import { usingFallbackCredentials } from "@/lib/server/secrets.server";
import { ensureSeed } from "@/lib/server/seed";

/**
 * Admin API — seed-profile generation and profile management.
 *
 * Gating, in order:
 *   1. Trusted-origin check (CSRF), same as every other mutating route.
 *   2. `ADMIN_DISABLED=1` removes the surface entirely — 404, not 403, so its
 *      existence is not advertised.
 *   3. The caller must be a signed-in user whose email is on the admin
 *      allowlist (or whose id is in `ADMIN_IDS`). A non-admin gets 404 too.
 *
 * Generation is metered tightly. Each persona costs two queued jobs on a
 * volunteer GPU network, and the point of the tool is a few dozen test
 * profiles, not a firehose.
 */
const SEED_PER_HOUR = 30;
const MUTATION_PER_HOUR = 600;

const noStore = { "cache-control": "no-store" };
const notFound = () => new Response("Not found", { status: 404 });

/**
 * Resolve the caller and make sure the configured admin login exists.
 *
 * The bootstrap runs here rather than at module load: it needs the database,
 * and on a serverless cold start the very first admin request is the earliest
 * point at which the DB is guaranteed ready. It memoises, so this is one cheap
 * awaited promise per process thereafter.
 */
async function admin(request: Request) {
  if (!adminEnabled()) return null;
  try {
    await ensureAdminAccount();
  } catch (err) {
    console.error("[admin] bootstrap failed:", err);
  }
  const user = await getSessionUserFromRequest(request);
  return user && isAdminUser(user) ? user : null;
}

export const Route = createFileRoute("/api/admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const forbidden = forbiddenUnlessTrustedOrigin(request);
        if (forbidden) return forbidden;
        if (!adminEnabled()) return notFound();

        const url = new URL(request.url);

        // `whoami` is deliberately reachable without an admin session: the sign
        // -in card needs to know whether the console exists and whether it is
        // already signed in. It leaks nothing but that.
        if (url.searchParams.get("what") === "whoami") {
          try {
            await ensureAdminAccount();
          } catch (err) {
            console.error("[admin] bootstrap failed:", err);
          }
          const user = await getSessionUserFromRequest(request);
          return Response.json(
            {
              signedIn: Boolean(user),
              isAdmin: isAdminUser(user),
              email: isAdminUser(user) ? user!.email : null,
              name: isAdminUser(user) ? user!.name : null,
            },
            { headers: noStore },
          );
        }

        const user = await admin(request);
        if (!user) return notFound();

        if (url.searchParams.get("what") === "models") {
          const models = await hordeImageModels();
          return Response.json({ models }, { headers: noStore });
        }

        // The console lists every profile in the database, so make sure the
        // demo cohort actually exists — otherwise a cold preview shows only the
        // admin's own row and looks broken.
        await ensureSeed().catch((err) => console.error("[admin] seed skipped:", err));

        const [jobs, profiles, horde] = await Promise.all([
          listSeedJobs(user.id, 30),
          listProfiles(user.id, 200),
          hordeAccount(),
        ]);
        return Response.json(
          { jobs, profiles, horde, fallbacks: usingFallbackCredentials() },
          { headers: noStore },
        );
      },

      POST: async ({ request }) => {
        const forbidden = forbiddenUnlessTrustedOrigin(request);
        if (forbidden) return forbidden;
        if (!adminEnabled()) return notFound();
        const user = await admin(request);
        if (!user) return notFound();

        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Bad request." }, { status: 400, headers: noStore });
        }
        const op = String(body.op ?? "");
        const jobId = Number(body.jobId);
        const userId = String(body.userId ?? "");

        sweepRateBuckets();
        if (!rateLimit(`admin:${user.id}`, MUTATION_PER_HOUR, 60 * 60 * 1000)) {
          return Response.json(
            { error: "Slow down. Try again in a bit." },
            { status: 429, headers: noStore },
          );
        }

        try {
          switch (op) {
            case "seed": {
              if (!rateLimit(`admin-seed:${user.id}`, SEED_PER_HOUR, 60 * 60 * 1000)) {
                return Response.json(
                  { error: `Generation is capped at ${SEED_PER_HOUR}/hour.` },
                  { status: 429, headers: noStore },
                );
              }
              const res = await startSeedJob(user.id, String(body.persona ?? ""));
              if ("error" in res) {
                return Response.json({ error: res.error }, { status: 400, headers: noStore });
              }
              return Response.json(res, { headers: noStore });
            }
            case "job": {
              const job = await pollSeedJob(user.id, jobId);
              // Discriminate on `id`, NOT on `"error" in job`: a SeedJob has its
              // own nullable `error` field, so the `in` check matched every
              // successful poll and 404'd the whole review queue.
              if (!("id" in job)) {
                return Response.json({ error: job.error }, { status: 404, headers: noStore });
              }
              return Response.json(job, { headers: noStore });
            }
            case "editDraft": {
              const patch =
                body.draft && typeof body.draft === "object"
                  ? (body.draft as Record<string, unknown>)
                  : {};
              const job = await updateSeedDraft(user.id, jobId, patch);
              if (!("id" in job)) {
                return Response.json({ error: job.error }, { status: 400, headers: noStore });
              }
              return Response.json(job, { headers: noStore });
            }
            case "retryImage": {
              const res = await retrySeedImage(user.id, jobId);
              if ("error" in res) {
                return Response.json({ error: res.error }, { status: 400, headers: noStore });
              }
              return Response.json(res, { headers: noStore });
            }
            case "approve": {
              const res = await approveSeedJob(user.id, jobId);
              if ("error" in res) {
                return Response.json({ error: res.error }, { status: 400, headers: noStore });
              }
              return Response.json(res, { headers: noStore });
            }
            case "discard":
              return Response.json(await discardSeedJob(user.id, jobId), { headers: noStore });
            case "suspend": {
              if (!userId) {
                return Response.json(
                  { error: "Missing userId." },
                  { status: 400, headers: noStore },
                );
              }
              if (userId === user.id) {
                return Response.json(
                  { error: "You cannot suspend the account you are signed in with." },
                  { status: 400, headers: noStore },
                );
              }
              await setProfileSuspended(user.id, userId, Boolean(body.suspended));
              const profiles = await listProfiles(user.id, 200);
              return Response.json({ ok: true, profiles }, { headers: noStore });
            }
            case "deleteProfile": {
              if (!userId) {
                return Response.json(
                  { error: "Missing userId." },
                  { status: 400, headers: noStore },
                );
              }
              if (userId === user.id) {
                return Response.json(
                  { error: "You cannot delete the account you are signed in with." },
                  { status: 400, headers: noStore },
                );
              }
              await deleteProfile(user.id, userId);
              const profiles = await listProfiles(user.id, 200);
              return Response.json({ ok: true, profiles }, { headers: noStore });
            }
            case "purgeAi": {
              const res = await purgeAiProfiles(user.id);
              const profiles = await listProfiles(user.id, 200);
              return Response.json({ ...res, profiles }, { headers: noStore });
            }
            default:
              return Response.json({ error: "Unknown op." }, { status: 400, headers: noStore });
          }
        } catch (err) {
          if (err instanceof ForbiddenError) {
            return Response.json({ error: err.message }, { status: 403, headers: noStore });
          }
          console.error("[admin] op failed:", op, err);
          return Response.json({ error: "That failed." }, { status: 500, headers: noStore });
        }
      },
    },
  },
});
