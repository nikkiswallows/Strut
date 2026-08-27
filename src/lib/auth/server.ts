/**
 * Self-hosted Better Auth for Strut — the ONE identity layer for the app.
 *
 * Server-only. Never import from client code (it pulls in `pg` / PGlite and
 * server internals). The client uses `@/lib/auth/client`; components read the
 * user via `@/lib/auth/use-current-user`; server code gets a verified user via
 * `getSessionUser` / `requireUserId` from `@/lib/auth/session.server`.
 *
 * Methods (all first-party, all on this origin):
 *   - email + password            (built-in emailAndPassword)
 *   - Google / X (Twitter)        (direct OAuth using THIS app's credentials)
 *   - passwordless phone OTP      (official `phoneNumber` plugin; Twilio in
 *                                  production, a code shown in the UI in dev)
 *
 * Sessions are Better Auth sessions: a HttpOnly, Secure, SameSite=Lax cookie
 * for browsers (set automatically by /api/auth/*), plus `bearer()` so future
 * native apps can send `Authorization: Bearer <token>`. There is no parallel
 * token table and nothing is mirrored into localStorage.
 */
import { betterAuth } from "better-auth";
import { bearer, phoneNumber } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { appBaseUrl, env, hasDatabase, isProduction, smsConfigured } from "@/lib/env";
import { ensureDbReady, getPglite } from "../db";
import { stashDevOtp } from "./otp-dev.server";
import { pgliteDialect } from "./pglite-dialect";
import { deliverSmsOtp } from "./sms.server";

// Kick (and share) PGlite bootstrap as soon as this module loads in preview.
void ensureDbReady();

/**
 * Cookie/session signing secret.
 * - Production: MUST be set (`BETTER_AUTH_SECRET`); we refuse to silently mint a
 *   per-instance secret, which would log everyone out on every serverless cold
 *   start. We still derive a stable fallback from DATABASE_URL so a missing var
 *   never takes the whole site down — but set BETTER_AUTH_SECRET explicitly.
 * - Preview/dev: a process-stable random secret on globalThis (survives HMR,
 *   resets with the process, which is fine because PGlite resets too).
 */
const globalSecret = globalThis as typeof globalThis & {
  __strutAuthSecret__?: string;
};
function authSecret(): string {
  const injected = env("BETTER_AUTH_SECRET") ?? env("AUTH_SECRET");
  if (injected) return injected;
  const db = env("DATABASE_URL");
  if (db) {
    // Deterministic across isolates from the DB URL (kept server-side).
    return `strut.auth.v2.${db}`;
  }
  globalSecret.__strutAuthSecret__ ??= randomBytes(32).toString("hex");
  return globalSecret.__strutAuthSecret__;
}

if (isProduction() && !env("BETTER_AUTH_SECRET") && !env("AUTH_SECRET")) {
  console.warn(
    "[auth] BETTER_AUTH_SECRET is not set — using a DATABASE_URL-derived key. " +
      "Set BETTER_AUTH_SECRET in production for stable, rotatable sessions.",
  );
}

/** Database: real Postgres when DATABASE_URL is set, else embedded PGlite. */
const database = hasDatabase()
  ? new Pool({ connectionString: env("DATABASE_URL") })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

const baseUrl = appBaseUrl();

/**
 * Trusted origins for credentialed (CSRF-checked) requests. We trust the app's
 * configured base URL, loopback dev variants, and — crucially — the PER-REQUEST
 * origin/host, so Vercel preview aliases and production custom domains can never
 * disagree with BETTER_AUTH_URL (the old "Invalid origin" failures). We only add
 * the request origin when its host is this deployment's own host (forwarded or
 * Host header), never an arbitrary third party.
 */
const STATIC_TRUSTED_ORIGINS = [
  baseUrl,
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];

function buildTrustedOrigins(request?: Request): string[] {
  const origins = [...STATIC_TRUSTED_ORIGINS];
  const add = (value: string | null | undefined) => {
    if (!value || value === "null") return;
    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      const origin = url.origin;
      if (!origins.includes(origin)) origins.push(origin);
    } catch {
      /* ignore malformed */
    }
  };
  if (request) {
    // The request's own forwarded/origin host is this deployment by definition.
    add(request.headers.get("origin"));
    const fwdHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const fwdProto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (new URL(request.url).protocol === "http:" ? "http" : "https");
    if (fwdHost) add(`${fwdProto}://${fwdHost}`);
    add(request.headers.get("referer"));
  }
  return origins;
}

/**
 * Google / X are registered ONLY when their credentials are present, so the app
 * boots and email/phone auth work before social sign-in is wired. Add the
 * redirect URIs below in each provider's console:
 *   Google: <APP_URL>/api/auth/callback/google
 *   X:      <APP_URL>/api/auth/callback/twitter
 */
const googleId = env("GOOGLE_CLIENT_ID");
const googleSecret = env("GOOGLE_CLIENT_SECRET");
const xId = env("X_CLIENT_ID") ?? env("TWITTER_CLIENT_ID");
const xSecret = env("X_CLIENT_SECRET") ?? env("TWITTER_CLIENT_SECRET");

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
if (googleId && googleSecret) socialProviders.google = { clientId: googleId, clientSecret: googleSecret };
if (xId && xSecret) socialProviders.twitter = { clientId: xId, clientSecret: xSecret };

export const auth = betterAuth({
  baseURL: baseUrl,
  secret: authSecret(),
  database,
  trustedOrigins: (request?: Request) => buildTrustedOrigins(request),

  // Standard, framework-managed session cookies: HttpOnly + Secure (on HTTPS) +
  // SameSite=Lax, path=/. Lax is correct for a first-party SPA: cookies ride
  // along on same-site GET navigations and on same-origin fetch/XHR POSTs.
  // Let Better Auth decide `secure`/prefix from the request protocol
  // automatically (true on Vercel HTTPS, false on local http) — forcing it off
  // the configured baseURL can mismatch preview aliases. (The earlier
  // SameSite=None/dual-token workarounds existed only to serve an embedded
  // cross-origin preview iframe, which is not a production surface.)
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
    // Behind Vercel's proxy the client IP is forwarded in these headers;
    // without them rate-limiting falls back to one shared bucket.
    ipAddress: {
      // Vercel forwards the client IP here; without it rate-limiting falls back
      // to one shared bucket. (Do NOT set a broad trustedProxies range — use the
      // real proxy CIDRs; Vercel sets these single-hop headers for us.)
      ipAddressHeaders: ["x-real-ip", "x-vercel-forwarded-for", "x-forwarded-for"],
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  socialProviders: socialProviders as never,

  plugins: [
    // Passwordless phone sign-in (Tinder-style). OTP delivery goes through
    // Twilio when configured; otherwise the code is returned by the dev
    // /api/phone/start route so local sign-in can finish.
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 5,
      requireVerification: false,
      signUpOnVerification: {
        getTempEmail: (phoneNumber: string) =>
          `phone.${phoneNumber.replace(/\D/g, "")}@phone.strut.app`,
        getTempName: (phoneNumber: string) => `Member ${phoneNumber.slice(-4)}`,
      },
      sendOTP: async ({ phoneNumber, code }) => {
        if (smsConfigured()) {
          await deliverSmsOtp(phoneNumber, code);
          return;
        }
        // No Twilio (local/preview): log + stash so /api/phone/start can show
        // the code on the verify screen. Never reached in production.
        console.log(`[auth] phone OTP for ${phoneNumber}: ${code}`);
        stashDevOtp(phoneNumber, code);
      },
    }),

    // Allow `Authorization: Bearer <session-token>` (native apps / API clients).
    // Only activates when the header is present; browser cookie auth is intact.
    bearer(),

    // Bridges Better Auth Set-Cookie into TanStack Start responses. Must be
    // last so it runs after every other plugin.
    tanstackStartCookies(),
  ],
});
