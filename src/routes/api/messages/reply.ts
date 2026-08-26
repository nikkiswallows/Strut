import { createFileRoute } from "@tanstack/react-router";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import { replyAsSeed } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/reply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            conversationId?: number;
            sessionToken?: string;
          };
          const userId = await userIdFromRequest(request, body.sessionToken);
          if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
          const text = await replyAsSeed(userId, Number(body.conversationId));
          return Response.json({ body: text });
        } catch (err) {
          console.error("[bot] reply route", err);
          return Response.json({ body: null });
        }
      },
    },
  },
});
