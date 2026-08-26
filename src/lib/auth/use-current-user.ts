import { useEffect, useState } from "react";
import { authClient, authEnabled, getBearerToken } from "./client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** True when this is the sandbox/dev fallback (auth not configured). */
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

type DeviceUser = { id: string; name: string | null };

export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime
  const { data, isPending } = authClient.useSession();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [device, setDevice] = useState<DeviceUser | null | undefined>(undefined);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (data?.user) {
      setDevice(null);
      return;
    }
    const token = getBearerToken();
    if (!token) {
      setDevice(null);
      return;
    }
    let cancelled = false;
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
      .then((payload: { userId?: string; name?: string | null }) => {
        if (cancelled) return;
        if (payload?.userId) setDevice({ id: payload.userId, name: payload.name ?? null });
        else setDevice(null);
      })
      .catch(() => {
        if (!cancelled) setDevice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.user, isPending]);

  if (data?.user) {
    return {
      user: {
        id: data.user.id,
        displayName: data.user.name ?? null,
        primaryEmail: data.user.email ?? null,
        profileImageUrl: data.user.image ?? null,
        isDevFallback: false,
      },
      isPending: false,
    };
  }

  const hasToken = typeof window !== "undefined" && Boolean(getBearerToken());
  if (isPending || (hasToken && device === undefined)) {
    return { user: null, isPending: true };
  }
  if (device) {
    return {
      user: {
        id: device.id,
        displayName: device.name,
        primaryEmail: null,
        profileImageUrl: null,
        isDevFallback: false,
      },
      isPending: false,
    };
  }
  return { user: null, isPending: false };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
