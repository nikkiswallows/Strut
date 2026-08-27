/**
 * Forward a request to Better Auth's internal handler and stream back its
 * response (including Set-Cookie) from a same-origin route.
 *
 * Lets us keep tidy app routes (/api/phone/*) that speak to Better Auth without
 * exposing the client to its exact paths. Browser cookies and forwarded host
 * headers are preserved so CSRF/origin checks and sessions work correctly.
 */
import { auth } from "./server";

function forwardHeaders(request: Request, origin: string): Headers {
  const headers = new Headers({
    "content-type": "application/json",
    accept: "application/json",
    origin,
    referer: request.headers.get("referer") || `${origin}/`,
  });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const authz = request.headers.get("authorization");
  if (authz) headers.set("authorization", authz);
  for (const key of [
    "host",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-forwarded-for",
    "user-agent",
  ]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  return headers;
}

export async function callAuth(
  request: Request,
  path: string,
  body: Record<string, unknown>,
  origin: string,
): Promise<Response> {
  return auth.handler(
    new Request(`${origin.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: forwardHeaders(request, origin),
      body: JSON.stringify(body),
    }),
  );
}
