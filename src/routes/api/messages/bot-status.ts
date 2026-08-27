import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { pumpBotJob } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/bot-status")({
  server: {
    handlers: {
      // GET /api/messages/bot-status?conversationId=123
      // Advances any pending bot reply (AI Horde poll) and reports state.
      //   { status: "pending", queuePosition } | { status: "ready" } | { status: "idle" }
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const conversationId = Number(url.searchParams.get("conversationId"));
          const user = await getSessionUserFromRequest(request);
          if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
          if (!Number.isFinite(conversationId)) {
            return Response.json({ status: "idle" }, { headers: { "cache-control": "no-store" } });
          }
          const r = await pumpBotJob(user.id, conversationId);
          const status = r.replied ? "ready" : r.pending ? "pending" : "idle";
          return Response.json(
            { status, queuePosition: r.queuePosition ?? null },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          console.error("[bot] status route", err);
          return Response.json({ status: "pending" }, { headers: { "cache-control": "no-store" } });
        }
      },
    },
  },
});
