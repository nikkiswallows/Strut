import { createFileRoute } from "@tanstack/react-router";
import { deleteSessionsByTokens, tokensFromRequest } from "@/lib/auth/session-from-request.server";
import { clearSessionHeaders } from "@/lib/server/device-session.server";

export const Route = createFileRoute("/api/session/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tokens = tokensFromRequest(request);
        try {
          await deleteSessionsByTokens(tokens);
        } catch {
          /* still clear the client */
        }
        const headers = clearSessionHeaders();
        headers.set("content-type", "application/json");
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      },
    },
  },
});
