import { getSql } from "@/lib/db";

const COOKIE_NAMES = new Set([
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
    if (COOKIE_NAMES.has(name) || /session_token$/i.test(name)) {
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

export async function userIdFromRequest(
  request: Request,
  extraToken?: string | null,
): Promise<string | null> {
  const tokens = tokensFromRequest(request, extraToken);
  if (tokens.length) {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ userId: string }>(
        `select "userId" from session
         where token = any($1::text[]) and "expiresAt" > now()
         limit 1`,
        [tokens],
      );
      if (rows[0]?.userId) return rows[0].userId;
    } catch {
      /* fall through to Better Auth */
    }
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

  try {
    const { auth } = await import("./server");
    const origin = (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return "http://localhost";
      }
    })();
    const probe = new Request(`${origin}/api/auth/get-session`, {
      method: "GET",
      headers: request.headers,
    });
    const res = await auth.handler(probe);
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as {
      user?: { id?: string };
      session?: { token?: string };
    } | null;
    return payload?.user?.id ?? null;
  } catch {
    return null;
  }
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
