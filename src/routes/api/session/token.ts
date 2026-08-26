import { createFileRoute } from "@tanstack/react-router";
import {
  sessionTokenForUser,
  userIdFromRequest,
} from "@/lib/auth/session-from-request.server";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/session/token")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await userIdFromRequest(request);
        if (!userId) {
          return Response.json(
            { token: null, userId: null, name: null },
            { headers: { "cache-control": "no-store" } },
          );
        }
        const token =
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
          (await sessionTokenForUser(userId));
        const sql = await getSql();
        const rows = await sql.query<{ name: string }>(
          `select name from "user" where id = $1`,
          [userId],
        );
        const headers = new Headers({
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        if (token) headers.set("set-auth-token", token);
        return new Response(
          JSON.stringify({ token, userId, name: rows[0]?.name ?? null }),
          { status: 200, headers },
        );
      },
    },
  },
});
