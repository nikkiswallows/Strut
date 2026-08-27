import { getBearerToken } from "@/lib/auth/client";
import { markOnboarded, writeLocalSession } from "@/lib/local-session";
import type { ProfileInput } from "@/lib/server/profiles";
import type { Profile } from "@/lib/types";

function authHeaders(token: string | null): HeadersInit {
  return {
    accept: "application/json",
    ...(token ? { authorization: `Bearer ${token}`, "x-strut-session": token } : {}),
  };
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const token = getBearerToken();
  if (!token) return null;
  const res = await fetch("/api/profile", {
    credentials: "same-origin",
    cache: "no-store",
    headers: authHeaders(token),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Could not load your profile.");
  const profile = (await res.json()) as Profile | null;
  if (profile?.onboarded) markOnboarded();
  return profile;
}

type ProfileResponse = {
  error?: string;
  token?: string;
  userId?: string;
  displayName?: string;
  onboarded?: boolean;
};

export async function postProfile(input: ProfileInput) {
  const token = getBearerToken();
  if (!token) throw new Error("Unauthorized");
  const res = await fetch("/api/profile", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ ...input, sessionToken: token }),
  });
  const payload = (await res.json().catch(() => null)) as ProfileResponse | null;
  if (!res.ok) {
    throw new Error(
      (payload && typeof payload.error === "string" && payload.error) ||
        "Could not save your profile.",
    );
  }
  if (payload?.token && payload.userId) {
    writeLocalSession({
      token: payload.token,
      userId: payload.userId,
      name: payload.displayName ?? input.displayName ?? null,
      onboarded: true,
    });
  } else {
    markOnboarded();
  }
  return payload;
}
