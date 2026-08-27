import { authEnabled, getBearerToken } from "@/lib/auth/client";
import { markOnboarded, writeLocalSession } from "@/lib/local-session";
import type { ProfileInput } from "@/lib/server/profiles";
import type { Profile } from "@/lib/types";
import { storeSessionBearer } from "@/lib/session-bearer";

export async function ensureLocalSession(displayName?: string): Promise<string | null> {
  const existing = getBearerToken();
  try {
    const res = await fetch("/api/session/ensure", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(existing ? { authorization: `Bearer ${existing}`, "x-strut-session": existing } : {}),
      },
      body: JSON.stringify({ sessionToken: existing, displayName }),
    });
    const payload = (await res.json().catch(() => null)) as {
      token?: string;
      userId?: string;
      name?: string | null;
    } | null;
    if (payload?.token && payload.userId) {
      writeLocalSession({
        token: payload.token,
        userId: payload.userId,
        name: payload.name ?? displayName ?? null,
      });
      return payload.token;
    }
    if (payload?.token) {
      storeSessionBearer(payload.token);
      return payload.token;
    }
  } catch {
    /* ignore */
  }
  return getBearerToken();
}

function authHeaders(token: string | null): HeadersInit {
  return {
    accept: "application/json",
    ...(token ? { authorization: `Bearer ${token}`, "x-strut-session": token } : {}),
  };
}

export async function fetchMyProfile(): Promise<Profile | null> {
  // When auth is disabled (VITE_AUTH_ENABLED=false), return the dev user fallback
  if (!authEnabled) return {
    id: 0,
    userId: "dev-user",
    handle: "dev-user",
    displayName: "Dev User",
    age: null,
    hideAge: false,
    identities: ["T-Girl"],
    pronouns: ["she/her"],
    role: "Switch",
    bio: "",
    location: "",
    lookingFor: ["Dates"],
    photos: [],
    interests: [],
    heightCm: null,
    lat: null,
    lng: null,
    isSeed: false,
    lastActive: "",
    onboarded: false,
    createdAt: "",
    likedByMe: undefined,
    likesMe: undefined,
    matched: undefined,
    following: undefined,
    likeCount: undefined,
    distanceMiles: undefined,
  };
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
  } else if (payload?.token) {
    storeSessionBearer(payload.token);
    markOnboarded();
  } else {
    markOnboarded();
  }
  return payload;
}
