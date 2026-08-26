import { randomBytes, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { sessionTokenForUser, userIdFromRequest } from "@/lib/auth/session-from-request.server";

export function sessionCookie(token: string): string {
  return `strut_session=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}

export function sessionHeaders(token: string): Headers {
  const headers = new Headers({
    "cache-control": "no-store",
    "set-auth-token": token,
  });
  headers.append("set-cookie", sessionCookie(token));
  return headers;
}

export async function createDeviceSession(
  name: string,
): Promise<{ userId: string; token: string }> {
  const sql = await getSql();
  const userId = randomUUID();
  const sessionId = randomUUID();
  const token = `stk_${randomBytes(32).toString("base64url")}`;
  const email = `device-${userId.replace(/-/g, "")}@strut.app`;
  const display = (name || "Member").trim().slice(0, 40) || "Member";
  await sql.query(
    `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     values ($1, $2, $3, false, now(), now())`,
    [userId, display, email],
  );
  await sql.query(
    `insert into session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
     values ($1, now() + interval '365 days', $2, now(), now(), $3)`,
    [sessionId, token, userId],
  );
  return { userId, token };
}

export async function mintSessionForUser(userId: string): Promise<string> {
  const existing = await sessionTokenForUser(userId);
  if (existing) return existing;
  const sql = await getSql();
  const token = `stk_${randomBytes(32).toString("base64url")}`;
  await sql.query(
    `insert into session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
     values ($1, now() + interval '365 days', $2, now(), now(), $3)`,
    [randomUUID(), token, userId],
  );
  return token;
}

export async function ensureSession(
  request: Request,
  extraToken?: string | null,
  name?: string,
): Promise<{ userId: string; token: string; created: boolean }> {
  const existingId = await userIdFromRequest(request, extraToken);
  if (existingId) {
    const token = await mintSessionForUser(existingId);
    return { userId: existingId, token, created: false };
  }
  const created = await createDeviceSession(name || "Member");
  return { ...created, created: true };
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
