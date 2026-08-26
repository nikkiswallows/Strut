import { useEffect, useState } from "react";
import { authEnabled } from "./client";
import {
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

export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
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

export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [user, setUser] = useState<AppUser | null>(null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const sync = () => setUser(userFromLocal());
    sync();
    setHydrated(true);
    const unsub = subscribeLocalSession(sync);

    const token = tokenFromAnywhere();
    const existing = readLocalSession();
    if (!existing && token) {
      void fetch("/api/session/token", {
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          "x-strut-session": token,
        },
      })
        .then((res) => res.json())
        .then((payload: { token?: string; userId?: string; name?: string | null }) => {
          if (payload?.userId && (payload.token || token)) {
            writeLocalSession({
              token: payload.token || token,
              userId: payload.userId,
              name: payload.name ?? null,
            });
          }
        })
        .catch(() => {
          /* keep whatever local session we have */
        });
    }
    return unsub;
  }, []);

  if (!hydrated) return { user: null, isPending: true };
  return { user, isPending: false };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
