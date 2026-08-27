import { createFileRoute } from "@tanstack/react-router";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import { getSql } from "@/lib/db";
import { mintSessionForUser, sessionHeaders } from "@/lib/server/device-session.server";

export const Route = createFileRoute("/api/session/token")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await userIdFromRequest(request);
        if (!userId) {
          return Response.json(
            { token: null, userId: null, name: null, onboarded: false },
            { headers: { "cache-control": "no-store" } },
          );
        }
        const token = await mintSessionForUser(userId);
        const sql = await getSql();
        const userRows = await sql.query<{ name: string }>(
          `select name from "user" where id = $1`,
          [userId],
        );
        const profileRows = await sql.query<{ onboarded: boolean }>(
          `select onboarded from profiles where user_id = $1`,
          [userId],
        );
        const headers = sessionHeaders(token);
        headers.set("content-type", "application/json");
        return new Response(
          JSON.stringify({
            token,
            userId,
            name: userRows[0]?.name ?? null,
            onboarded: Boolean(profileRows[0]?.onboarded),
          }),
          { status: 200, headers },
        );
      },
    },
  },
});
