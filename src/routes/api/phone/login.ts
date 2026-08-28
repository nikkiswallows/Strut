import { createFileRoute } from "@tanstack/react-router";
import { callAuth } from "@/lib/auth/forward.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { publicOrigin } from "@/lib/auth/public-origin.server";
import { toE164, countryByIso, nationalDigits, isValidNational } from "@/lib/phone";
import { rateLimit, sweepRateBuckets, clientIp } from "@/lib/server/rate-limit";

/**
 * A 6-digit code is 1,000,000 possibilities — trivial to brute force if the
 * endpoint is unmetered. Better Auth caps attempts per code (allowedAttempts: 5)
 * but an attacker can simply mint a fresh code each time, so we meter the
 * verification endpoint itself in both dimensions.
 */
const PER_NUMBER_PER_HOUR = 10;
const PER_IP_PER_HOUR = 30;

/**
 * Merge Set-Cookie response headers into an existing Cookie request header.
 *
 * Without this, the post-verify session lookup below would run with the
 * *original* request cookies — which, on a fresh sign-up, contain no session at
 * all — so the verified user id would always be null and the client would fall
 * back to Better Auth's payload (or fail outright).
 */
function mergeCookies(existing: string | null, setCookies: string[]): string | null {
  if (!setCookies.length) return existing;
  const jar = new Map<string, string>();
  for (const pair of (existing ?? "").split(";")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  for (const cookie of setCookies) {
    const pair = cookie.split(";")[0]?.trim();
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    // A zero-length value with no expiry is how a cookie gets cleared.
    if (!value) jar.delete(name);
    else jar.set(name, value);
  }
  const merged = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  return merged || null;
}

/** Turn Better Auth's error strings into something a human can act on. */
function friendlyVerifyError(raw: string | undefined): string {
  const message = (raw ?? "").toLowerCase();
  if (message.includes("expired")) return "That code expired. Send a new one.";
  if (message.includes("invalid") || message.includes("incorrect")) {
    return "That code isn't right. Check the text and try again.";
  }
  if (message.includes("attempt") || message.includes("too many")) {
    return "Too many wrong tries. Send a new code.";
  }
  if (message.includes("not found") || message.includes("no verification")) {
    return "Start again — we couldn't find a code for that number.";
  }
  return "That code didn't work. Request a new one.";
}

export const Route = createFileRoute("/api/phone/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const noStore = { "cache-control": "no-store" };
        try {
          const body = (await request.json()) as {
            iso?: string;
            national?: string;
            code?: string;
          };
          const iso = body.iso?.trim().toUpperCase() ?? "";
          const country = countryByIso(iso);
          if (!country) throw new Error("Pick a country.");
          const national = nationalDigits(iso, body.national ?? "");
          if (!isValidNational(iso, national)) {
            throw new Error("Enter a valid mobile number.");
          }
          const phoneNumber = toE164(iso, national);
          const code = (body.code ?? "").replace(/\D/g, "");
          if (code.length !== 6) throw new Error("Enter the 6-digit code.");

          sweepRateBuckets();
          const ip = clientIp(request);
          if (!rateLimit(`otpv:num:${phoneNumber}`, PER_NUMBER_PER_HOUR, 60 * 60 * 1000)) {
            return Response.json(
              { error: "Too many attempts on that number. Try again in an hour." },
              { status: 429, headers: noStore },
            );
          }
          if (!rateLimit(`otpv:ip:${ip}`, PER_IP_PER_HOUR, 60 * 60 * 1000)) {
            return Response.json(
              { error: "Too many attempts. Try again later." },
              { status: 429, headers: noStore },
            );
          }

          // Better Auth verifies the OTP, creates the user on first sign-in,
          // and sets the session cookie — we stream its Set-Cookie straight back.
          const res = await callAuth(
            request,
            "/api/auth/phone-number/verify",
            { phoneNumber, code },
            publicOrigin(request),
          );
          const json = (await res.json().catch(() => null)) as
            | { message?: string; token?: string; user?: { id?: string } }
            | null;

          if (!res.ok) {
            // Deliberately uniform: never reveal whether the number exists.
            return Response.json(
              { error: friendlyVerifyError(json?.message) },
              { status: 400, headers: { "content-type": "application/json", ...noStore } },
            );
          }

          const headers = new Headers({
            "content-type": "application/json",
            ...noStore,
          });
          const setCookies = res.headers.getSetCookie();
          for (const cookie of setCookies) headers.append("set-cookie", cookie);

          // Resolve the *new* session (cookie merged in) so `userId` is real
          // even on a first-ever sign-up.
          const sessionHeaders = new Headers(request.headers);
          const merged = mergeCookies(request.headers.get("cookie"), setCookies);
          if (merged) sessionHeaders.set("cookie", merged);
          else sessionHeaders.delete("cookie");

          const sessionReq = new Request(request.url, {
            method: "GET",
            headers: sessionHeaders,
          });
          const user = await getSessionUserFromRequest(sessionReq);

          return new Response(
            JSON.stringify({
              ok: true,
              e164: phoneNumber,
              userId: user?.id ?? json?.user?.id ?? null,
            }),
            { status: 200, headers },
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Could not verify that code.";
          return Response.json(
            { error: message },
            {
              status: 400,
              headers: { "content-type": "application/json", ...noStore },
            },
          );
        }
      },
    },
  },
});
