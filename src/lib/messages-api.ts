import { tokenFromAnywhere } from "@/lib/local-session";
import { refreshLocalSession, sessionHeaders } from "@/lib/session-client";

async function parse<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (payload && typeof payload.error === "string" && payload.error) || "Request failed.",
    );
  }
  return payload;
}

async function authed(path: string, json?: Record<string, unknown>) {
  let token = tokenFromAnywhere();
  const send = (authToken: string | null) =>
    fetch(path, {
      method: json ? "POST" : "GET",
      credentials: "include",
      cache: "no-store",
      headers: sessionHeaders(authToken, Boolean(json)),
      body: json ? JSON.stringify({ ...json, sessionToken: authToken }) : undefined,
    });
  let res = await send(token);
  if (res.status === 401) {
    token = await refreshLocalSession();
    res = await send(token);
  }
  return parse(res);
}

export async function fetchConversations() {
  return authed("/api/messages/list") as Promise<{
    conversations: import("@/lib/types").ConversationPreview[];
  }>;
}

export async function fetchThread(id: number) {
  return authed(`/api/messages/thread?id=${id}`) as Promise<{
    thread: Awaited<ReturnType<typeof import("@/lib/server/chat.server").getChat>>;
  }>;
}

export async function postOpenChat(otherUserId: string) {
  return authed("/api/messages/open", { otherUserId }) as Promise<{ id: number }>;
}

export async function postSendChat(conversationId: number, body: string) {
  return authed("/api/messages/send", { conversationId, body }) as Promise<{
    ok: true;
    seed: boolean;
  }>;
}

export async function postBotReply(conversationId: number) {
  return authed("/api/messages/reply", { conversationId }) as Promise<{ body: string | null }>;
}
