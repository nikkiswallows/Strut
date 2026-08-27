/**
 * Tiny same-origin JSON fetch helper. Auth is the first-party HttpOnly session
 * cookie, sent automatically (`credentials: "include"`) — there is no token to
 * attach. 401 responses surface as an "Unauthorized" error the UI routes to
 * /login.
 */
export async function http<T>(
  path: string,
  json?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(path, {
    method: json ? "POST" : "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(json ? { "content-type": "application/json" } : {}),
    },
    body: json ? JSON.stringify(json) : undefined,
  });
  const payload = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) {
    throw new Error(
      (payload && typeof payload.error === "string" && payload.error) ||
        "Request failed.",
    );
  }
  return payload as T;
}

/** Call the app op endpoint: `app("discover", {...}) -> data`. */
export async function app<T>(
  op: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const payload = await http<{ data: T }>("/api/app", { op, ...data });
  return payload.data;
}
