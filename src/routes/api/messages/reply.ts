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
          const result = await replyAsSeed(user.id, Number(body.conversationId));
          // "replied" = fast providers answered inline (body included).
          // "pending" = handed to the uncensored async worker (AI Horde); the
          // client should poll /api/messages/bot-status until it resolves.
          return Response.json(result, {
            headers: { "cache-control": "no-store" },
          });
        } catch (err) {
          console.error("[bot] reply route", err);
          return Response.json({ status: "noop" });
        }
      },
    },
  },
});
