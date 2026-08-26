import { createFileRoute } from "@tanstack/react-router";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import { sendChat } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            conversationId?: number;
            body?: string;
            sessionToken?: string;
          };
          const userId = await userIdFromRequest(request, body.sessionToken);
          if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
          const result = await sendChat(userId, Number(body.conversationId), body.body ?? "");
          return Response.json({ ok: true, seed: result.seed });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not send.";
          const status = message === "Unauthorized" ? 401 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
