import { useEffect, useState } from "react";
import {
  readLocalSession,
  subscribeLocalSession,
  tokenFromAnywhere,
  writeLocalSession,
} from "@/lib/local-session";
import { sessionHeaders } from "@/lib/session-client";

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
  const res = await fetch("/api/session/token", {
    credentials: "include",
    cache: "no-store",
    headers: sessionHeaders(token),
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
  // Do not wipe a local session just because this GET missed cookies/token.
  // iPhone Safari drops Lax cookies on some fetches; logging them out here is
  // what stranded people on /login with no way back through Google.
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
