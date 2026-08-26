import { getBearerToken } from "@/lib/auth/client";
import { storeSessionBearer } from "@/lib/session-bearer";
import type { ProfileInput } from "@/lib/server/profiles";

async function hydrateToken(): Promise<string | null> {
  const existing = getBearerToken();
  if (existing) return existing;
  try {
    const res = await fetch("/api/session/token", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => null)) as { token?: string } | null;
    if (payload?.token) {
      storeSessionBearer(payload.token);
      return payload.token;
    }
  } catch {
    /* ignore */
  }
  return getBearerToken();
}

function authHeaders(): HeadersInit {
  const token = getBearerToken();
  return {
    accept: "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchMyProfile() {
  await hydrateToken();
  const res = await fetch("/api/profile", {
    credentials: "same-origin",
    cache: "no-store",
    headers: authHeaders(),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Could not load your profile.");
  return res.json();
}

export async function postProfile(input: ProfileInput) {
  await hydrateToken();
  const res = await fetch("/api/profile", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => null)) as
    | { error?: string }
    | Record<string, unknown>
    | null;
  if (!res.ok) {
    throw new Error(
      (payload && "error" in payload && typeof payload.error === "string" && payload.error) ||
        "Could not save your profile.",
    );
  }
  return payload;
}
