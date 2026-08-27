import { createFileRoute } from "@tanstack/react-router";
import { isTrustedAppOrigin } from "@/lib/auth/isolation.server";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import { getSql } from "@/lib/db";
import { requireSession, sessionHeaders } from "@/lib/server/device-session.server";
import { PROFILE_COLS, mapProfile, type ProfileRow } from "@/lib/server/map";
import { writeProfileForUser, type ProfileInput } from "@/lib/server/profiles";

type ProfileBody = ProfileInput & { sessionToken?: string | null };

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await userIdFromRequest(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
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
          if (!isTrustedAppOrigin(request)) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
          const input = (await request.json()) as ProfileBody;
          const { sessionToken, ...profileInput } = input;
          const session = await requireSession(request, sessionToken);
          const profile = await writeProfileForUser(session.userId, profileInput);
          const headers = sessionHeaders(session.token);
          headers.set("content-type", "application/json");
          return new Response(
            JSON.stringify({
              ...profile,
              token: session.token,
              userId: session.userId,
            }),
            { status: 200, headers },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not save profile.";
          return Response.json(
            { error: message },
            { status: message === "Unauthorized" ? 401 : 400 },
          );
        }
      },
    },
  },
});
