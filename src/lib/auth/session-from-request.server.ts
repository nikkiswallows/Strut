import { getSql } from "@/lib/db";
import { lookupValues, tokenCandidates, tokensFromRequest } from "./session-tokens";

export { lookupValues, tokenCandidates, tokensFromRequest };

export async function lookupUserIdByTokens(tokens: string[]): Promise<string | null> {
  if (!tokens.length) return null;
  const sql = await getSql();
  const values = lookupValues(tokens);
  const exact = await sql.query<{ userId: string }>(
    `select "userId" from session where token = any($1::text[]) and "expiresAt" > now() limit 1`,
    [values],
  );
  if (exact[0]?.userId) return exact[0].userId;
  for (const token of tokens) {
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

async function userIdFromBetterAuth(
  request: Request,
  extraToken?: string | null,
): Promise<string | null> {
  try {
    const { auth } = await import("./server");
    const attempts: Headers[] = [];

    const withExtra = new Headers(request.headers);
    if (extraToken) withExtra.set("Authorization", `Bearer ${extraToken}`);
    attempts.push(withExtra);

    // A stale Authorization value must not hide a valid session cookie.
    // iPhone Safari also sometimes omits Lax cookies on first-party POSTs.
    const cookiesOnly = new Headers(request.headers);
    cookiesOnly.delete("authorization");
    cookiesOnly.delete("Authorization");
    attempts.push(cookiesOnly);

    const bearerValues = [
      extraToken,
      request.headers.get("authorization"),
      request.headers.get("x-strut-session"),
    ].filter((value): value is string => Boolean(value && value.trim()));

    for (const raw of bearerValues) {
      const token = raw.replace(/^Bearer\s+/i, "").trim();
      if (!token) continue;
      const bearerOnly = new Headers();
      bearerOnly.set("Authorization", `Bearer ${token}`);
      attempts.push(bearerOnly);
    }

    for (const headers of attempts) {
      try {
        const session = await auth.api.getSession({ headers });
        if (session?.user?.id) return session.user.id;
      } catch {
        /* try the next header set */
      }
    }
  } catch {
    /* ignore */
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

  return userIdFromBetterAuth(request, extraToken);
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

export async function deleteSessionsByTokens(tokens: string[]): Promise<void> {
  if (!tokens.length) return;
  const sql = await getSql();
  for (const token of tokens) {
    await sql.query(`delete from session where token = $1`, [token]);
  }
}
