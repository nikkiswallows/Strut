import {
  clearLocalSession,
  markOnboarded,
  tokenFromAnywhere,
  writeLocalSession,
} from "@/lib/local-session";
import { persistPhotoList } from "@/lib/media";
import { refreshLocalSession, sessionHeaders } from "@/lib/session-client";
import type { ProfileInput } from "@/lib/server/profiles";
import type { Profile } from "@/lib/types";

export async function fetchMyProfile(): Promise<Profile | null> {
  let token = tokenFromAnywhere();
  if (!token) token = await refreshLocalSession();
  const res = await fetch("/api/profile", {
    credentials: "include",
    cache: "no-store",
    headers: sessionHeaders(token),
  });
  if (res.status === 401) {
    // Bearer was sent and the server still said no — that token is dead.
    if (token) clearLocalSession();
    throw new Error("Unauthorized");
  }
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

async function postProfileOnce(input: ProfileInput, token: string | null, useBearer: boolean) {
  const res = await fetch("/api/profile", {
    method: "POST",
    credentials: "include",
    headers: sessionHeaders(useBearer ? token : null, true),
    body: JSON.stringify({ ...input, sessionToken: token }),
  });
  const payload = (await res.json().catch(() => null)) as ProfileResponse | null;
  return { res, payload };
}

export async function postProfile(input: ProfileInput) {
  const photos = await persistPhotoList(input.photos ?? []);
  const payloadInput = { ...input, photos };
  let token = tokenFromAnywhere() || (await refreshLocalSession());
  let { res, payload } = await postProfileOnce(payloadInput, token, true);
  if (res.status === 401) {
    token = await refreshLocalSession();
    ({ res, payload } = await postProfileOnce(payloadInput, token, true));
  }
  if (res.status === 401) {
    ({ res, payload } = await postProfileOnce(payloadInput, token, false));
  }
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
