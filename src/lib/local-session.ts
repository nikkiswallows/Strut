/** First-party session that does not depend on Better Auth cookies. */

export const LOCAL_SESSION_KEY = "strut.session.v1";
const SID_KEY = "strut.sid";
const COOKIE = "strut_at";
const EVENT = "strut-session";
const DRAFT_KEY = "strut.onboarding.draft.v1";

export type LocalSession = {
  token: string;
  userId: string;
  name: string | null;
  onboarded?: boolean;
};

let memory: LocalSession | null = null;

function emit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

function setCookie(token: string | null): void {
  if (typeof document === "undefined") return;
  if (token) {
    document.cookie = `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=None; Secure`;
  } else {
    document.cookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=None; Secure`;
  }
}

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )strut_at=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function parseSession(raw: string | null): LocalSession | null {
  if (!raw) return null;
  try {
    if (raw.includes("\t") && !raw.startsWith("{")) {
      const [token, userId, flag] = raw.split("\t");
      if (token && userId) {
        return { token, userId, name: null, onboarded: flag === "1" };
      }
      return null;
    }
    const parsed = JSON.parse(raw) as LocalSession;
    if (parsed?.token && parsed?.userId && parsed.userId !== "pending") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function compact(session: LocalSession): string {
  return `${session.token}\t${session.userId}\t${session.onboarded ? "1" : "0"}`;
}

function freeQuota(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function persist(session: LocalSession): void {
  const json = JSON.stringify(session);
  const sid = compact(session);
  const write = (storage: Storage) => {
    storage.setItem(SID_KEY, sid);
    storage.setItem(LOCAL_SESSION_KEY, json);
    storage.setItem("grok-auth.bearer-token", session.token);
  };
  try {
    write(window.localStorage);
  } catch {
    freeQuota();
    try {
      write(window.localStorage);
    } catch {
      try {
        window.localStorage.setItem(SID_KEY, sid);
      } catch {
        /* give up on localStorage */
      }
    }
  }
  try {
    write(window.sessionStorage);
  } catch {
    try {
      window.sessionStorage.setItem(SID_KEY, sid);
    } catch {
      /* ignore */
    }
  }
  setCookie(session.token);
}

export function readLocalSession(): LocalSession | null {
  if (memory) return memory;
  if (typeof window === "undefined") return null;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const fromSid = parseSession(storage.getItem(SID_KEY));
      if (fromSid) {
        memory = fromSid;
        return fromSid;
      }
      const fromJson = parseSession(storage.getItem(LOCAL_SESSION_KEY));
      if (fromJson) {
        memory = fromJson;
        return fromJson;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function writeLocalSession(session: LocalSession): void {
  const prev = memory ?? readLocalSession();
  const userId = session.userId.trim();
  const sameUser = Boolean(prev && prev.userId === userId);
  const next: LocalSession = {
    token: session.token.trim(),
    userId,
    // A new account must not inherit the previous person's name or onboarded flag.
    name: session.name ?? (sameUser ? prev?.name ?? null : null),
    onboarded: session.onboarded ?? (sameUser ? Boolean(prev?.onboarded) : false),
  };
  if (!next.token || !next.userId) return;
  memory = next;
  if (typeof window === "undefined") return;
  persist(next);
  emit();
}

export function markOnboarded(): void {
  const session = readLocalSession();
  if (!session) return;
  writeLocalSession({ ...session, onboarded: true });
}

export function clearLocalSession(): void {
  memory = null;
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      storage.removeItem(LOCAL_SESSION_KEY);
      storage.removeItem(SID_KEY);
      storage.removeItem("grok-auth.bearer-token");
    } catch {
      /* ignore */
    }
  }
  setCookie(null);
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
