import { createFileRoute } from "@tanstack/react-router";
import { isTrustedAppOrigin } from "@/lib/auth/isolation.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { getSql } from "@/lib/db";
import { PROFILE_COLS, mapProfile, type ProfileRow } from "@/lib/server/map";
import { writeProfileForUser, type ProfileInput } from "@/lib/server/profiles";

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const sql = await getSql();
        const rows = await sql.query<ProfileRow>(
          `select ${PROFILE_COLS} from profiles where user_id = $1`,
          [user.id],
        );
        return Response.json(rows[0] ? mapProfile(rows[0]) : null, {
          headers: { "cache-control": "no-store" },
        });
      },
      POST: async ({ request }) => {
        try {
          if (!isTrustedAppOrigin(request)) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
          const user = await getSessionUserFromRequest(request);
          if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
          const input = (await request.json()) as ProfileInput;
          const profile = await writeProfileForUser(user.id, input);
          return Response.json(profile, {
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not save profile.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
