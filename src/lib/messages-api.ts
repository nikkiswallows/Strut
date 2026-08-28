import { http } from "@/lib/http";

export async function fetchConversations() {
  return http<{
    conversations: import("@/lib/types").ConversationPreview[];
  }>("/api/messages/list");
}

export async function fetchThread(id: number) {
  return http<{
    thread: Awaited<
      ReturnType<typeof import("@/lib/server/chat.server").getChat>
    >;
  }>(`/api/messages/thread?id=${id}`);
}

export async function postOpenChat(otherUserId: string) {
  return http<{ id: number }>("/api/messages/open", { otherUserId });
}

export async function postSendChat(conversationId: number, body: string) {
  return http<{ ok: true; seed: boolean }>("/api/messages/send", {
    conversationId,
    body,
  });
}

export async function postBotReply(conversationId: number) {
  // Fast providers answer inline ("replied"); the uncensored async worker
  // (AI Horde) returns "pending" and the UI polls botStatus until "ready".
  return http<{ status: "replied" | "pending" | "noop"; body?: string | null }>(
    "/api/messages/reply",
    { conversationId },
  );
}

export async function botStatus(conversationId: number) {
  return http<{ status: "pending" | "ready" | "idle"; queuePosition?: number | null }>(
    `/api/messages/bot-status?conversationId=${conversationId}`,
  );
}

/**
 * Open a Server-Sent Events stream of live messages for a conversation. Returns
 * a close() handle. If the stream can't be opened (or drops), `onClose` fires so
 * the caller can fall back to its polling path.
 */
export function openConversationStream(
  conversationId: number,
  onEvent: (type: string, data: unknown) => void,
  onClose?: () => void,
): { close: () => void } {
  // AbortController-backed EventSource (EventSource itself has no built-in, but
  // we keep the reference so `.close()` is reliable across reconnects).
  let es: EventSource | null = null;
  let closed = false;
  try {
    es = new EventSource(`/api/messages/stream?conversationId=${conversationId}`);
    es.addEventListener("message", (e) => {
      try {
        onEvent("message", JSON.parse((e as MessageEvent).data));
      } catch {
        /* ignore bad frame */
      }
    });
    es.onerror = () => {
      if (!closed) onClose?.();
    };
  } catch {
    onClose?.();
  }
  return {
    close: () => {
      closed = true;
      es?.close();
    },
  };
}
