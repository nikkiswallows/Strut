/**
 * Browser-side Better Auth client for Strut.
 *
 * Talks to this app's own Better Auth at same-origin `/api/auth/*`. The session
 * lives in an HttpOnly cookie the browser stores automatically — there is NO
 * token in localStorage and NO manual bearer plumbing. Just call the methods
 * below; the cookie rides along on every same-origin request.
 */
import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [phoneNumberClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;

/** Human labels + ids for the direct-OAuth sign-in buttons. */
export const SOCIAL_PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "twitter", label: "X" },
] as const;

export type SocialProviderId = (typeof SOCIAL_PROVIDERS)[number]["id"];

/** Start Google / X sign-in (full-page redirect back to /auth/complete). */
export async function signInSocial(
  provider: SocialProviderId,
  callbackURL = "/auth/complete",
): Promise<void> {
  const { error } =
    provider === "google"
      ? await authClient.signIn.social({ provider: "google", callbackURL })
      : await authClient.signIn.social({ provider: "twitter", callbackURL });
  if (error) throw new Error(error.message ?? "Could not start sign-in.");
}

/** Email + password sign-up (creates the account) or sign-in. */
export async function signInWithEmail(input: {
  email: string;
  password: string;
  name?: string;
  join: boolean;
}): Promise<void> {
  if (input.join) {
    const { error } = await authClient.signUp.email({
      email: input.email,
      password: input.password,
      name: input.name?.trim() || input.email.split("@")[0] || "Member",
    });
    if (error) throw new Error(error.message ?? "Could not create your account.");
  } else {
    const { error } = await authClient.signIn.email({
      email: input.email,
      password: input.password,
    });
    if (error) throw new Error(error.message ?? "Invalid email or password.");
  }
}

/** Request a phone OTP code (Tinder-style passwordless sign-in). */
export async function sendPhoneOtp(phoneNumber: string): Promise<void> {
  const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber });
  if (error) throw new Error(error.message ?? "Could not send a code.");
}

/** Verify the phone OTP; creates + signs in the user on first use. */
export async function verifyPhoneOtp(input: {
  phoneNumber: string;
  code: string;
}): Promise<void> {
  const { error } = await authClient.phoneNumber.verify({
    phoneNumber: input.phoneNumber,
    code: input.code,
  });
  if (error) throw new Error(error.message ?? "That code didn't work.");
}

/** Sign out of the current session and redirect. */
export async function signOutAndRedirect(redirectTo = "/login"): Promise<void> {
  try {
    await authClient.signOut();
  } catch {
    /* clear client-side regardless */
  }
  if (typeof window !== "undefined") window.location.href = redirectTo;
}
