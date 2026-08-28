import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { getSql } from "@/lib/db";
import { subscribe, unsubscribe, type RealtimeEvent } from "@/lib/server/realtime.server";

/**
 * Server-Sent Events stream of live thread events for a conversation.
 *
 * `GET /api/messages/stream?conversationId=123` — holds the connection open and
 * pushes `event: message` frames as new messages land (user sends, seed replies,
 * bot job resolves). The client uses it as a fast path and still refetches on
 * event, so a missed frame just costs a short poll.
 *
 * Auth: caller must own the conversation. The response is text/event-stream,
 * no-cache; the connection ends when the client aborts (ReadableStream cancel)
 * or the server closes it.
 */
export const Route = createFileRoute("/api/messages/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(request.url);
        const conversationId = Number(url.searchParams.get("conversationId"));
        if (!Number.isFinite(conversationId)) {
          return Response.json({ error: "Missing conversation." }, { status: 400 });
        }

        // Authorize + confirm the caller belongs to this conversation.
        const sql = await getSql();
        const conv = await sql.query<{ user_a: string; user_b: string }>(
          `select user_a, user_b from conversations where id = $1`,
          [conversationId],
        );
        const row = conv[0];
        if (!row || (row.user_a !== user.id && row.user_b !== user.id)) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        const channel = `conv:${conversationId}`;

        let listener: ((e: RealtimeEvent) => void) | null = null;
        let heartbeat: ReturnType<typeof setInterval> | null = null;

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            // Keep-alive comment so proxies don't idle-close; SSE frames may be
            // literally blank lines.
            const keepAlive = () => controller.enqueue(encoder.encode(": keep-alive\n\n"));
            heartbeat = setInterval(keepAlive, 25_000);
            keepAlive();

            listener = (event) => {
              try {
                controller.enqueue(
                  encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.payload ?? {})}\n\n`),
                );
              } catch {
                // controller may be closed; ignore.
              }
            };
            subscribe(channel, listener);
          },
          cancel() {
            if (heartbeat) clearInterval(heartbeat);
            if (listener) subscribeToNothing(channel, listener);
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});

function subscribeToNothing(channel: string, listener: (e: RealtimeEvent) => void) {
  unsubscribe(channel, listener);
}
