import { createFileRoute } from "@tanstack/react-router";
import { forbiddenUnlessTrustedOrigin } from "@/lib/auth/isolation.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { rateLimit, sweepRateBuckets } from "@/lib/server/rate-limit";
import { openChat } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/open")({
  server: {
    handlers: {
      POST: async ({ request }) => {
          const forbidden = forbiddenUnlessTrustedOrigin(request);
          if (forbidden) return forbidden;
        try {
          const body = (await request.json()) as { otherUserId?: string };
          const user = await getSessionUserFromRequest(request);
          if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
          const userId = user.id;
          sweepRateBuckets();
          if (!rateLimit(`msg-open:${userId}`, 60, 60 * 60 * 1000)) {
            return Response.json(
              { error: "Too many requests. Slow down." },
              { status: 429, headers: { "cache-control": "no-store" } },
            );
          }
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
