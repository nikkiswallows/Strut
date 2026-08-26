import { createFileRoute } from "@tanstack/react-router";
import {
  sessionTokenForUser,
  userIdFromRequest,
} from "@/lib/auth/session-from-request.server";

export const Route = createFileRoute("/api/session/token")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await userIdFromRequest(request);
        if (!userId) {
          return Response.json(
            { token: null, userId: null },
            { headers: { "cache-control": "no-store" } },
          );
        }
        const token =
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
          (await sessionTokenForUser(userId));
        const headers = new Headers({
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        if (token) headers.set("set-auth-token", token);
        return new Response(JSON.stringify({ token, userId }), { status: 200, headers });
      },
    },
  },
});
