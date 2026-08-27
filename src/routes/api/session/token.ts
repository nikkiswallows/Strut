import { createFileRoute } from "@tanstack/react-router";
import {
  sessionTokenForUser,
  userIdFromRequest,
} from "@/lib/auth/session-from-request.server";
import { getSql } from "@/lib/db";
import { sessionHeaders } from "@/lib/server/device-session.server";

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
        const presented =
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
          request.headers.get("x-strut-session")?.trim() ||
          null;
        const token = presented || (await sessionTokenForUser(userId));
        const sql = await getSql();
        const userRows = await sql.query<{ name: string }>(
          `select name from "user" where id = $1`,
          [userId],
        );
        const profileRows = await sql.query<{ onboarded: boolean }>(
          `select onboarded from profiles where user_id = $1`,
          [userId],
        );
        const headers = token ? sessionHeaders(token) : new Headers({ "cache-control": "no-store" });
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
