/**
 * Tinder-style membership: an account (session) is not a profile.
 *
 * - guest: no proven login
 * - needs-profile: logged in, no completed `profiles` row
 * - member: server says onboarded — only then the dating app opens
 *
 * LocalStorage `onboarded` is a cache, never a gate.
 */
export type MembershipPhase = "loading" | "guest" | "needs-profile" | "member";

export function planMembership(input: {
  sessionPending: boolean;
  userId: string | null;
  profilePending: boolean;
  onboarded: boolean;
  unauthorized: boolean;
}): MembershipPhase {
  if (input.sessionPending) return "loading";
  if (input.unauthorized || !input.userId) return "guest";
  if (input.profilePending) return "loading";
  if (input.onboarded) return "member";
  return "needs-profile";
}

export function pathForMembership(phase: MembershipPhase): "/login" | "/onboarding" | "/discover" | null {
  if (phase === "guest") return "/login";
  if (phase === "needs-profile") return "/onboarding";
  if (phase === "member") return "/discover";
  return null;
}
