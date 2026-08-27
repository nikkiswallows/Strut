import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { openChat } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/open")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { otherUserId?: string };
          const user = await getSessionUserFromRequest(request);
          if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
          const userId = user.id;
          const opened = await openChat(userId, body.otherUserId ?? "");
          return Response.json(opened);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not open chat.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
