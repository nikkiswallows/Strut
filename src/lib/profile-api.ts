import { getBearerToken } from "@/lib/auth/client";
import { storeSessionBearer } from "@/lib/session-bearer";
import type { ProfileInput } from "@/lib/server/profiles";

async function hydrateToken(): Promise<string | null> {
  const existing = getBearerToken();
  if (existing) return existing;
  try {
    const sessionRes = await fetch("/api/auth/get-session", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const session = (await sessionRes.json().catch(() => null)) as {
      session?: { token?: string };
    } | null;
    if (session?.session?.token) {
      storeSessionBearer(session.session.token);
      return session.session.token;
    }
  } catch {
    /* ignore */
  }
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

function authHeaders(token: string | null): HeadersInit {
  return {
    accept: "application/json",
    ...(token ? { authorization: `Bearer ${token}`, "x-strut-session": token } : {}),
  };
}

export async function fetchMyProfile() {
  const token = await hydrateToken();
  const res = await fetch("/api/profile", {
    credentials: "same-origin",
    cache: "no-store",
    headers: authHeaders(token),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Could not load your profile.");
  return res.json();
}

export async function postProfile(input: ProfileInput) {
  const token = await hydrateToken();
  const res = await fetch("/api/profile", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ ...input, sessionToken: token }),
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
