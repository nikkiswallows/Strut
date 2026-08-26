/** Same key the preview auth client reads for server functions. */
export const SESSION_BEARER_KEY = "grok-auth.bearer-token";

type AuthPayload = { token?: string | null };

export function storeSessionBearer(token: string | null | undefined): void {
  if (!token || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_BEARER_KEY, token);
  } catch {
    /* storage blocked */
  }
}

export function captureAuthToken(data: unknown, response?: Response | null): void {
  const fromBody =
    data && typeof data === "object" && "token" in data
      ? String((data as AuthPayload).token ?? "")
      : "";
  const fromHeader = response?.headers.get("set-auth-token") ?? "";
  storeSessionBearer(fromBody || fromHeader || null);
}
