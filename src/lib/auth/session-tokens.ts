/** Pure session-token parsing. Safe to import from tests and the server. */

export const SESSION_COOKIE_NAMES = new Set([
  "strut_at",
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
    if (SESSION_COOKIE_NAMES.has(name) || /session_token$/i.test(name)) {
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
