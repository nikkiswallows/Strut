import { readLocalSession, tokenFromAnywhere, writeLocalSession } from "@/lib/local-session";

export function sessionHeaders(token: string | null, json = false): Record<string, string> {
  return {
    accept: "application/json",
    ...(json ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}`, "x-strut-session": token } : {}),
  };
}

/**
 * Ask the server for a DB-backed session token and persist it. GET still sends
 * cookies on iPhone even when POSTs drop Lax cookies, so this is how we mint a
 * token the next profile save can present as Bearer / body.
 */
export async function refreshLocalSession(): Promise<string | null> {
  const token = tokenFromAnywhere();
  try {
    const res = await fetch("/api/session/token", {
      credentials: "include",
      cache: "no-store",
      headers: sessionHeaders(token),
    });
    const payload = (await res.json().catch(() => null)) as {
      token?: string | null;
      userId?: string | null;
      name?: string | null;
      onboarded?: boolean | null;
    } | null;
    if (payload?.userId && (payload.token || token)) {
      const next = payload.token || token!;
      const existing = readLocalSession();
      writeLocalSession({
        token: next,
        userId: payload.userId,
        name: payload.name ?? (existing?.userId === payload.userId ? existing.name : null),
        onboarded: Boolean(payload.onboarded),
      });
      return next;
    }
    return null;
  } catch {
    return tokenFromAnywhere();
  }
}
