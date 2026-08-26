import { createFileRoute } from "@tanstack/react-router";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import { getSql } from "@/lib/db";
import { ensureSession, sessionHeaders } from "@/lib/server/device-session.server";
import { PROFILE_COLS, mapProfile, type ProfileRow } from "@/lib/server/map";
import { writeProfileForUser, type ProfileInput } from "@/lib/server/profiles";
import { ensureSeed } from "@/lib/server/seed";

type ProfileBody = ProfileInput & { sessionToken?: string | null };

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await userIdFromRequest(request);
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
          const input = (await request.json()) as ProfileBody;
          const { sessionToken, ...profileInput } = input;
          const session = await ensureSession(
            request,
            sessionToken,
            profileInput.displayName,
          );
          const profile = await writeProfileForUser(session.userId, profileInput);
          const headers = sessionHeaders(session.token);
          headers.set("content-type", "application/json");
          return new Response(JSON.stringify({ ...profile, token: session.token }), {
            status: 200,
            headers,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not save profile.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
