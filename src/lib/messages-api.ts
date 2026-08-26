import { getBearerToken } from "@/lib/auth/client";

function authHeaders(token: string | null, json = false): HeadersInit {
  return {
    accept: "application/json",
    ...(json ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}`, "x-strut-session": token } : {}),
  };
}

async function parse<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (payload && typeof payload.error === "string" && payload.error) || "Request failed.",
    );
  }
  return payload;
}

export async function fetchConversations() {
  const token = getBearerToken();
  const res = await fetch("/api/messages/list", {
    credentials: "same-origin",
    cache: "no-store",
    headers: authHeaders(token),
  });
  return parse<{ conversations: import("@/lib/types").ConversationPreview[] }>(res);
}

export async function fetchThread(id: number) {
  const token = getBearerToken();
  const res = await fetch(`/api/messages/thread?id=${id}`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: authHeaders(token),
  });
  return parse<{
    thread: Awaited<ReturnType<typeof import("@/lib/server/chat.server").getChat>>;
  }>(res);
}

export async function postOpenChat(otherUserId: string) {
  const token = getBearerToken();
  const res = await fetch("/api/messages/open", {
    method: "POST",
    credentials: "same-origin",
    headers: authHeaders(token, true),
    body: JSON.stringify({ otherUserId, sessionToken: token }),
  });
  return parse<{ id: number }>(res);
}

export async function postSendChat(conversationId: number, body: string) {
  const token = getBearerToken();
  const res = await fetch("/api/messages/send", {
    method: "POST",
    credentials: "same-origin",
    headers: authHeaders(token, true),
    body: JSON.stringify({ conversationId, body, sessionToken: token }),
  });
  return parse<{ ok: true; seed: boolean }>(res);
}

export async function postBotReply(conversationId: number) {
  const token = getBearerToken();
  const res = await fetch("/api/messages/reply", {
    method: "POST",
    credentials: "same-origin",
    headers: authHeaders(token, true),
    body: JSON.stringify({ conversationId, sessionToken: token }),
  });
  return parse<{ body: string | null }>(res);
}
