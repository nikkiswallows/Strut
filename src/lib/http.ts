import { tokenFromAnywhere } from "@/lib/local-session";
import { refreshLocalSession, sessionHeaders } from "@/lib/session-client";

export async function http<T>(path: string, json?: Record<string, unknown>): Promise<T> {
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
  if (res.status === 401 && json) {
    token = await refreshLocalSession();
    res = await send(token);
  }
  const payload = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (payload && typeof payload.error === "string" && payload.error) || "Request failed.",
    );
  }
  return payload as T;
}

export async function app<T>(op: string, data: Record<string, unknown> = {}) {
  const token = tokenFromAnywhere();
  const payload = await http<{ data: T }>("/api/app", { op, ...data, sessionToken: token });
  return payload.data;
}
