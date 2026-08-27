import { getRequest } from "@tanstack/react-start/server";

/**
 * Fetch-Metadata sibling isolation — **server-only** (`.server.ts` suffix).
 *
 * MUST keep the `.server` suffix: this file imports `@tanstack/react-start/server`
 * (`getRequest` → Node `AsyncLocalStorage`). If it is imported from a dual
 * client/server module under a non-`.server` name, Vite ships it to the browser
 * and the app dies with: `AsyncLocalStorage is not a constructor`.
 *
 * Apps deployed on `*.grok.me` are "same-site" to each other but MUTUALLY
 * UNTRUSTED, and a `SameSite=Lax` session cookie IS sent on same-site
 * subrequests — so without this, a malicious sibling could make a SCRIPTED
 * (fetch/XHR/form-POST) request to this app's server functions and ride this
 * app's session cookie.
 *
 * We allow: same-origin, non-browser, top-level GET navigations, and any
 * request whose Origin/Referer host is THIS host (iOS Safari sometimes
 * reports `sec-fetch-site: cross-site` on first-party POSTs).
 */
export class CrossSiteRequestError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden: cross-site request blocked");
    this.name = "CrossSiteRequestError";
  }
}

function requestHost(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.toLowerCase();
  try {
    return new URL(request.url).host.toLowerCase();
  } catch {
    return (request.headers.get("host") ?? "").toLowerCase();
  }
}

function headerHost(value: string | null): string | null {
  if (!value || value === "null") return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/** True when Origin is missing (same-origin) or matches this host. */
export function isTrustedAppOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return true;
  const here = requestHost(request);
  const from = headerHost(origin);
  return Boolean(here && from && here === from);
}

/** Throw `CrossSiteRequestError` for a scripted cross-site/sibling request. */
export function assertSameSiteRequest(): void {
  const request = getRequest();
  if (!request) return;
  const h = request.headers;
  const site = h.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return;

  const here = requestHost(request);
  const from = headerHost(h.get("origin")) || headerHost(h.get("referer"));
  if (here && from && here === from) return;

  const dest = h.get("sec-fetch-dest");
  const isTopLevelGet =
    h.get("sec-fetch-mode") === "navigate" &&
    request.method === "GET" &&
    dest !== "object" &&
    dest !== "embed";
  if (isTopLevelGet) return;
  throw new CrossSiteRequestError();
}
