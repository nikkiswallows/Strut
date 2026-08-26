import { createFileRoute } from "@tanstack/react-router";
import { ensureSession, sessionHeaders } from "@/lib/server/device-session.server";

export const Route = createFileRoute("/api/session/ensure")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            sessionToken?: string;
            displayName?: string;
          };
          const session = await ensureSession(request, body.sessionToken, body.displayName);
          const headers = sessionHeaders(session.token);
          headers.set("content-type", "application/json");
          return new Response(
            JSON.stringify({
              token: session.token,
              userId: session.userId,
              created: session.created,
            }),
            { status: 200, headers },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not start a session.";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
