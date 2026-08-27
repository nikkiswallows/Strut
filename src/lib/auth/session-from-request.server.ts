import { getSql } from "@/lib/db";
import { tokenCandidates, tokensFromRequest } from "./session-tokens";

export { tokenCandidates, tokensFromRequest };

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

export async function deleteSessionsByTokens(tokens: string[]): Promise<void> {
  if (!tokens.length) return;
  const sql = await getSql();
  for (const token of tokens) {
    await sql.query(`delete from session where token = $1`, [token]);
  }
}
