import { createFileRoute } from "@tanstack/react-router";
import { requireSession, sessionHeaders } from "@/lib/server/device-session.server";

export const Route = createFileRoute("/api/session/ensure")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            sessionToken?: string;
            displayName?: string;
          };
          const session = await requireSession(request, body.sessionToken);
          const headers = sessionHeaders(session.token);
          headers.set("content-type", "application/json");
          return new Response(
            JSON.stringify({
              token: session.token,
              userId: session.userId,
              created: false,
              name: body.displayName ?? null,
            }),
            { status: 200, headers },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unauthorized";
          return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
        }
      },
    },
  },
});
