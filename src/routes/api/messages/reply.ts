import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { replyAsSeed } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/reply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { conversationId?: number };
          const user = await getSessionUserFromRequest(request);
          if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
          const userId = user.id;
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
