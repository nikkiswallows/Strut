import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { getSql } from "@/lib/db";
import { subscribe, unsubscribe, type RealtimeEvent } from "@/lib/server/realtime.server";

// Per-user concurrent SSE connection cap (per warm instance). Each connection
// pins a server response open; without a cap one account can script dozens of
// streams. In-process by necessity — same trade-off as the realtime bus below.
// Counts reset after 30 idle minutes so a leaked stream can't wedge a user out.
const MAX_STREAMS_PER_USER = 4;
const STREAM_STALE_MS = 30 * 60 * 1000;
const streamsRef = globalThis as typeof globalThis & {
  __strutSseStreams__?: Map<string, { count: number; lastAt: number }>;
};
function streamCounters(): Map<string, { count: number; lastAt: number }> {
  return (streamsRef.__strutSseStreams__ ??= new Map());
}
function acquireStream(userId: string): boolean {
  const now = Date.now();
  const map = streamCounters();
  const entry = map.get(userId);
  if (!entry || now - entry.lastAt > STREAM_STALE_MS) {
    map.set(userId, { count: 1, lastAt: now });
    return true;
  }
  if (entry.count >= MAX_STREAMS_PER_USER) return false;
  entry.count += 1;
  entry.lastAt = now;
  return true;
}
function releaseStream(userId: string): void {
  const map = streamCounters();
  const entry = map.get(userId);
  if (!entry) return;
  entry.count -= 1;
  entry.lastAt = Date.now();
  if (entry.count <= 0) map.delete(userId);
}

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
        if (!acquireStream(user.id)) {
          return Response.json(
            { error: "Too many live connections." },
            { status: 429 },
          );
        }

        const userId = user.id;
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
            releaseStream(userId);
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
