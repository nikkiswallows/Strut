import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@/lib/types";
import { fetchMyProfile } from "@/lib/profile-api";
import { planMembership, type MembershipPhase } from "./membership";
import { useCurrentUserState, type AppUser } from "./use-current-user";

export type Membership = {
  phase: MembershipPhase;
  user: AppUser | null;
  profile: Profile | null;
};

export function useMembership(): Membership {
  const { user, isPending } = useCurrentUserState();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMyProfile(),
    enabled: Boolean(user),
    retry: 1,
  });
  const unauthorized =
    me.error instanceof Error && /unauthorized/i.test(me.error.message);
  const phase = planMembership({
    sessionPending: isPending,
    userId: user?.id ?? null,
    profilePending: Boolean(user) && me.isPending,
    onboarded: Boolean(me.data?.onboarded),
    unauthorized,
  });
  return { phase, user, profile: me.data ?? null };
}
