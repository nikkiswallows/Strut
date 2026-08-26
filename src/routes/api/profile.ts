import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { PROFILE_COLS, mapProfile, type ProfileRow } from "@/lib/server/map";
import { writeProfileForUser, type ProfileInput } from "@/lib/server/profiles";
import { ensureSeed } from "@/lib/server/seed";

async function userIdFrom(request: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await userIdFrom(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        await ensureSeed();
        const sql = await getSql();
        const rows = await sql.query<ProfileRow>(
          `select ${PROFILE_COLS} from profiles where user_id = $1`,
          [userId],
        );
        return Response.json(rows[0] ? mapProfile(rows[0]) : null, {
          headers: { "cache-control": "no-store" },
        });
      },
      POST: async ({ request }) => {
        try {
          const userId = await userIdFrom(request);
          if (!userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
          const input = (await request.json()) as ProfileInput;
          const profile = await writeProfileForUser(userId, input);
          return Response.json(profile, {
            headers: { "cache-control": "no-store" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not save profile.";
          const status = message === "Unauthorized" ? 401 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
