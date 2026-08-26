/** First-party session that does not depend on Better Auth cookies. */

export const LOCAL_SESSION_KEY = "strut.session.v1";
const COOKIE = "strut_at";
const EVENT = "strut-session";

export type LocalSession = {
  token: string;
  userId: string;
  name: string | null;
};

function emit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

function setCookie(token: string | null): void {
  if (typeof document === "undefined") return;
  if (token) {
    document.cookie = `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
  } else {
    document.cookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  }
}

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )strut_at=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function put(storage: Storage, value: LocalSession | null): void {
  try {
    if (value) storage.setItem(LOCAL_SESSION_KEY, JSON.stringify(value));
    else storage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    /* storage blocked */
  }
}

export function readLocalSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = storage.getItem(LOCAL_SESSION_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as LocalSession;
      if (parsed?.token && parsed?.userId && parsed.userId !== "pending") return parsed;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function writeLocalSession(session: LocalSession): void {
  if (typeof window === "undefined") return;
  const next: LocalSession = {
    token: session.token.trim(),
    userId: session.userId.trim(),
    name: session.name ?? null,
  };
  if (!next.token || !next.userId) return;
  put(window.localStorage, next);
  put(window.sessionStorage, next);
  setCookie(next.token);
  try {
    window.localStorage.setItem("grok-auth.bearer-token", next.token);
    window.sessionStorage.setItem("grok-auth.bearer-token", next.token);
  } catch {
    /* ignore */
  }
  emit();
}

export function clearLocalSession(): void {
  if (typeof window === "undefined") return;
  put(window.localStorage, null);
  put(window.sessionStorage, null);
  setCookie(null);
  try {
    window.localStorage.removeItem("grok-auth.bearer-token");
    window.sessionStorage.removeItem("grok-auth.bearer-token");
  } catch {
    /* ignore */
  }
  emit();
}

export function subscribeLocalSession(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function tokenFromAnywhere(): string | null {
  const session = readLocalSession();
  if (session?.token) return session.token;
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem("grok-auth.bearer-token") ||
      window.sessionStorage.getItem("grok-auth.bearer-token") ||
      readCookie()
    );
  } catch {
    return readCookie();
  }
}
