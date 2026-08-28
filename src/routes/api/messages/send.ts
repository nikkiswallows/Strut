import { createFileRoute } from "@tanstack/react-router";
import { forbiddenUnlessTrustedOrigin } from "@/lib/auth/isolation.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { clientIp, rateLimit, sweepRateBuckets } from "@/lib/server/rate-limit";
import { sendChat } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
          const forbidden = forbiddenUnlessTrustedOrigin(request);
          if (forbidden) return forbidden;
        try {
          const body = (await request.json()) as {
            conversationId?: number;
            body?: string;
          };
          const user = await getSessionUserFromRequest(request);
          if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
          const userId = user.id;
          // Messaging was entirely unmetered: one account could flood a
          // conversation (or many) with no ceiling at all. 120/hour is far
          // above any human conversation and stops scripted harassment.
          sweepRateBuckets();
          if (!rateLimit(`msg-send:${userId}`, 120, 60 * 60 * 1000)) {
            return Response.json(
              { error: "Too many messages. Slow down." },
              { status: 429, headers: { "cache-control": "no-store" } },
            );
          }
          if (!rateLimit(`msg-send:ip:${clientIp(request)}`, 400, 60 * 60 * 1000)) {
            return Response.json(
              { error: "Too many messages. Slow down." },
              { status: 429, headers: { "cache-control": "no-store" } },
            );
          }
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
