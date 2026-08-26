/** Same key the preview auth client reads for server functions. */
export const SESSION_BEARER_KEY = "grok-auth.bearer-token";

type AuthPayload = { token?: string | null };

function write(storage: Storage, token: string | null): void {
  try {
    if (token) storage.setItem(SESSION_BEARER_KEY, token);
    else storage.removeItem(SESSION_BEARER_KEY);
  } catch {
    /* storage blocked */
  }
}

export function storeSessionBearer(token: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const value = token?.trim() || null;
  if (!value) return;
  write(window.sessionStorage, value);
  write(window.localStorage, value);
}

export function restoreSessionBearer(): void {
  if (typeof window === "undefined") return;
  try {
    const session = window.sessionStorage.getItem(SESSION_BEARER_KEY);
    const local = window.localStorage.getItem(SESSION_BEARER_KEY);
    if (local && !session) window.sessionStorage.setItem(SESSION_BEARER_KEY, local);
    if (session && !local) window.localStorage.setItem(SESSION_BEARER_KEY, session);
  } catch {
    /* storage blocked */
  }
}

export function clearSessionBearer(): void {
  if (typeof window === "undefined") return;
  write(window.sessionStorage, null);
  write(window.localStorage, null);
}

export function captureAuthToken(data: unknown, response?: Response | null): void {
  const fromBody =
    data && typeof data === "object" && "token" in data
      ? String((data as AuthPayload).token ?? "")
      : "";
  const fromHeader = response?.headers.get("set-auth-token") ?? "";
  storeSessionBearer(fromBody || fromHeader || null);
}
