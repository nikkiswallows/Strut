import { useSession } from "./client";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: false;
};

export type CurrentUserState = {
  user: AppUser | null;
  isPending: boolean;
};

/**
 * Current signed-in user, straight from Better Auth's session (HttpOnly cookie).
 * `isPending` is true only while the session is still being resolved on first
 * load — gate signed-out UI on it to avoid a signed-out flash.
 */
export function useCurrentUserState(): CurrentUserState {
  const { data, isPending } = useSession();
  if (isPending) return { user: null, isPending: true };
  const u = data?.user;
  if (!u?.id) return { user: null, isPending: false };
  return {
    user: {
      id: u.id,
      displayName: u.name ?? null,
      primaryEmail: u.email ?? null,
      profileImageUrl: u.image ?? null,
      isDevFallback: false,
    },
    isPending: false,
  };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
