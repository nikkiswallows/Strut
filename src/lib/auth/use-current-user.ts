import { useEffect, useState } from "react";
import {
  clearLocalSession,
  readLocalSession,
  subscribeLocalSession,
  tokenFromAnywhere,
  writeLocalSession,
} from "@/lib/local-session";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};

export type CurrentUserState = {
  user: AppUser | null;
  isPending: boolean;
};

function userFromLocal(): AppUser | null {
  const session = readLocalSession();
  if (!session) return null;
  return {
    id: session.userId,
    displayName: session.name,
    primaryEmail: null,
    profileImageUrl: null,
    isDevFallback: false,
  };
}

async function recoverSessionFromServer(): Promise<void> {
  const existing = readLocalSession();
  const token = tokenFromAnywhere();
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
    headers["x-strut-session"] = token;
  }
  const res = await fetch("/api/session/token", {
    credentials: "same-origin",
    cache: "no-store",
    headers,
  });
  const payload = (await res.json().catch(() => null)) as {
    token?: string | null;
    userId?: string | null;
    name?: string | null;
    onboarded?: boolean | null;
  } | null;
  if (payload?.userId && (payload.token || token)) {
    writeLocalSession({
      token: payload.token || token!,
      userId: payload.userId,
      name: payload.name ?? existing?.name ?? null,
      onboarded: payload.onboarded ?? existing?.onboarded,
    });
    return;
  }
  if (res.ok && (existing || token) && !payload?.userId) {
    clearLocalSession();
  }
}

export function useCurrentUserState(): CurrentUserState {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(userFromLocal());
    sync();
    const unsub = subscribeLocalSession(sync);
    void recoverSessionFromServer()
      .catch(() => {
        /* keep whatever local session we have */
      })
      .finally(() => setHydrated(true));
    return unsub;
  }, []);

  if (!hydrated) return { user: null, isPending: true };
  return { user, isPending: false };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
