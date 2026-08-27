import { randomBytes, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { sessionTokenForUser, userIdFromRequest } from "@/lib/auth/session-from-request.server";

/**
 * SameSite=None so iPhone Safari still sends the cookie on first-party POSTs it
 * sometimes mislabels as cross-site (Lax cookies are dropped; the page stays
 * signed in from GET/navigation). CSRF is checked via Origin on mutating routes.
 */
export function sessionCookie(token: string, name = "strut_session"): string {
  const httpOnly = name === "strut_session" ? "; HttpOnly" : "";
  return `${name}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=None; Secure${httpOnly}`;
}

export function clearSessionCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0; SameSite=None; Secure`;
}

export function sessionHeaders(token: string): Headers {
  const headers = new Headers({
    "cache-control": "no-store",
    "set-auth-token": token,
  });
  headers.append("set-cookie", sessionCookie(token, "strut_session"));
  headers.append("set-cookie", sessionCookie(token, "strut_at"));
  return headers;
}

export function clearSessionHeaders(): Headers {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const name of [
    "strut_session",
    "strut_at",
    "__Host-grok-auth.session_token",
    "__Host-grok-auth.session_data",
  ]) {
    headers.append("set-cookie", clearSessionCookie(name));
  }
  return headers;
}

export async function mintSessionForUser(userId: string): Promise<string> {
  const existing = await sessionTokenForUser(userId);
  // Only reuse first-party tokens the iPhone can echo on POST. Better Auth
  // hashes are not something the browser has in raw form.
  if (existing && existing.startsWith("stk_")) return existing;
  const sql = await getSql();
  const token = `stk_${randomBytes(32).toString("base64url")}`;
  await sql.query(
    `insert into session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
     values ($1, now() + interval '365 days', $2, now(), now(), $3)`,
    [randomUUID(), token, userId],
  );
  return token;
}

/** Look up an existing login. Never creates an anonymous user. */
export async function requireSession(
  request: Request,
  extraToken?: string | null,
): Promise<{ userId: string; token: string }> {
  const existingId = await userIdFromRequest(request, extraToken);
  if (!existingId) {
    throw new Error("Unauthorized");
  }
  const token = await mintSessionForUser(existingId);
  return { userId: existingId, token };
}

export async function migrateProfile(fromUserId: string, toUserId: string): Promise<void> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;
  const sql = await getSql();
  const dest = await sql.query<{ onboarded: boolean }>(
    `select onboarded from profiles where user_id = $1`,
    [toUserId],
  );
  if (dest[0]?.onboarded) return;
  await sql.query(`delete from profiles where user_id = $1`, [toUserId]);
  await sql.query(`update profiles set user_id = $1 where user_id = $2`, [toUserId, fromUserId]);
}

export async function durableSessionFromAuthToken(
  request: Request,
  authToken: string,
): Promise<{ userId: string; token: string }> {
  const userId = await userIdFromRequest(request, authToken);
  if (!userId) throw new Error("Could not create your account.");
  const token = await mintSessionForUser(userId);
  return { userId, token };
}
