/**
 * Server-side session resolution — the ONLY way server code identifies a user.
 *
 * Backed entirely by Better Auth. The session arrives as a first-party HttpOnly
 * cookie (browser) or an `Authorization: Bearer <token>` header (native/API).
 * Never trust a client-supplied user id — only the result of these functions.
 *
 * Usage from a route handler that already has the `Request`:
 *   const user = await getSessionUserFromRequest(request);
 *
 * Usage from a TanStack Start server function (uses the ambient request):
 *   export const fn = createServerFn({ method: "POST" })
 *     .handler(async () => { const userId = await requireUserId(); ... });
 */
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "./server";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string;
  image: string | null;
  phoneNumber: string | null;
};

function toSessionUser(data: {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    phoneNumber?: string | null;
  };
}): SessionUser | null {
  const u = data.user;
  if (!u?.id) return null;
  return {
    id: u.id,
    email: u.email ?? null,
    name: u.name ?? "Member",
    image: u.image ?? null,
    phoneNumber: u.phoneNumber ?? null,
  };
}

/**
 * Resolve the session from an explicit `Request`. Accepts the cookie and/or a
 * bearer token already present in its headers.
 */
export async function getSessionUserFromRequest(
  request: Request,
): Promise<SessionUser | null> {
  try {
    const data = await auth.api.getSession({ headers: request.headers });
    return toSessionUser(data ?? {});
  } catch (err) {
    console.error("[auth] getSession failed:", err);
    return null;
  }
}

/** Resolve the session from the ambient TanStack Start request. */
export async function getSessionUser(
  bearerToken?: string,
): Promise<SessionUser | null> {
  const request = getRequest();
  if (!request) return null;
  const headers = new Headers(request.headers);
  if (bearerToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${bearerToken}`);
  }
  return getSessionUserFromRequest(new Request(request.url, { headers }));
}

/** Require a signed-in user id, or throw a 401-shaped error. */
export async function requireUserId(bearerToken?: string): Promise<string> {
  const user = await getSessionUser(bearerToken);
  if (!user) throw new UnauthorizedError();
  return user.id;
}

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
