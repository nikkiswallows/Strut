import { createMiddleware } from "@tanstack/react-start";
import { assertSameSiteRequest } from "./isolation.server";
import { getSessionUser, UnauthorizedError } from "./session.server";

/**
 * Auth middleware for TanStack Start server functions — the standard way to get
 * the caller's verified user id. Server functions are same-origin POSTs, so the
 * first-party session cookie is sent automatically; the optional bearer token
 * (future native apps) is forwarded from the client hook.
 *
 *   import { createServerFn } from "@tanstack/react-start";
 *   import { authMiddleware } from "@/lib/auth/middleware";
 *
 *   export const doThing = createServerFn({ method: "POST" })
 *     .middleware([authMiddleware])
 *     .handler(async ({ context }) => {
 *       // context.userId is verified; scope every query by it.
 *     });
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    // Browsers rely on the HttpOnly cookie (nothing to forward). This hook is
    // here so a future native/web build can attach a bearer token centrally.
    return next({ sendContext: { bearerToken: undefined as string | undefined } });
  })
  .server(async ({ next, context }) => {
    assertSameSiteRequest();
    const user = await getSessionUser(context.bearerToken);
    if (!user) throw new UnauthorizedError();
    return next({ context: { userId: user.id, user } });
  });
