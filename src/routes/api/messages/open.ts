import { createFileRoute } from "@tanstack/react-router";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import { openChat } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/open")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { otherUserId?: string; sessionToken?: string };
          const userId = await userIdFromRequest(request, body.sessionToken);
          if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
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
