import { getSql } from "@/lib/db";

const COOKIE_NAMES = new Set([
  "strut_session",
  "__Host-grok-auth.session_token",
  "grok-auth.session_token",
  "better-auth.session_token",
  "strut.session_token",
]);

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function tokenCandidates(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim().replace(/^Bearer\s+/i, "");
  if (!trimmed) return [];
  const decoded = decode(trimmed);
  const out = new Set<string>();
  for (const value of [trimmed, decoded]) {
    const clean = value.trim();
    if (!clean) continue;
    out.add(clean);
    const dot = clean.lastIndexOf(".");
    if (dot > 8) out.add(clean.slice(0, dot));
  }
  return [...out].filter((value) => value.length >= 8 && value.length < 512);
}

function tokensFromCookieHeader(cookie: string | null): string[] {
  if (!cookie) return [];
  const found: string[] = [];
  for (const part of cookie.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (COOKIE_NAMES.has(name) || /session_token$/i.test(name) || name === "strut_session") {
      found.push(...tokenCandidates(part.slice(eq + 1)));
    }
  }
  return found;
}

export function tokensFromRequest(request: Request, extra?: string | null): string[] {
  return [
    ...tokenCandidates(extra),
    ...tokenCandidates(request.headers.get("authorization")),
    ...tokenCandidates(request.headers.get("x-strut-session")),
    ...tokensFromCookieHeader(request.headers.get("cookie")),
  ].filter((value, index, all) => all.indexOf(value) === index);
}

export async function lookupUserIdByTokens(tokens: string[]): Promise<string | null> {
  if (!tokens.length) return null;
  const sql = await getSql();
  for (const token of tokens) {
    const exact = await sql.query<{ userId: string }>(
      `select "userId" from session where token = $1 and "expiresAt" > now() limit 1`,
      [token],
    );
    if (exact[0]?.userId) return exact[0].userId;
    const signed = await sql.query<{ userId: string }>(
      `select "userId" from session
       where "expiresAt" > now() and $1 like replace(token, '%', '\\%') || '.%'
       limit 1`,
      [token],
    );
    if (signed[0]?.userId) return signed[0].userId;
  }
  return null;
}

export async function userIdFromRequest(
  request: Request,
  extraToken?: string | null,
): Promise<string | null> {
  const tokens = tokensFromRequest(request, extraToken);
  try {
    const fromDb = await lookupUserIdByTokens(tokens);
    if (fromDb) return fromDb;
  } catch {
    /* fall through */
  }

  try {
    const { auth } = await import("./server");
    const headers = new Headers(request.headers);
    if (extraToken) headers.set("Authorization", `Bearer ${extraToken}`);
    const session = await auth.api.getSession({ headers });
    if (session?.user?.id) return session.user.id;
  } catch {
    /* ignore */
  }

  return null;
}

export async function sessionTokenForUser(userId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql.query<{ token: string }>(
    `select token from session
     where "userId" = $1 and "expiresAt" > now()
     order by "updatedAt" desc
     limit 1`,
    [userId],
  );
  return rows[0]?.token ?? null;
}
