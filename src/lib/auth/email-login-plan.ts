export type EmailAccountState = {
  exists: boolean;
  hasPassword: boolean;
  onboarded: boolean;
};

export type EmailLoginPlan = "signup" | "attach" | "signin" | "unknown" | "needs-join";

/**
 * How to finish an email login.
 *
 * Unfinished accounts (no password, or never onboarded) can set a password
 * via "Create a profile" so Google-only users aren't stuck when the broker
 * rejects this host's redirect URI.
 */
export function planEmailLogin(join: boolean, account: EmailAccountState): EmailLoginPlan {
  if (!account.exists) return join ? "signup" : "unknown";
  if (join && (!account.hasPassword || !account.onboarded)) return "attach";
  if (!join && !account.hasPassword) return "needs-join";
  return "signin";
}
