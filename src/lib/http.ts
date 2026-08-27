import { authEnabled, getBearerToken } from "@/lib/auth/client";

export async function http<T>(path: string, json?: Record<string, unknown>): Promise<T> {
  const token = getBearerToken();
  const res = await fetch(path, {
    method: json ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(json ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}`, "x-strut-session": token } : {}),
    },
    body: json ? JSON.stringify({ ...json, sessionToken: token }) : undefined,
  });
  const payload = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (payload && typeof payload.error === "string" && payload.error) || "Request failed.",
    );
  }
  return payload as T;
}

export async function app<T>(op: string, data: Record<string, unknown> = {}) {
  const token = getBearerToken();
  const payload = await http<{ data: T }>("/api/app", { op, ...data, sessionToken: token });
  return payload.data;
}
