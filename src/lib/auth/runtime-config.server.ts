/**
 * Public, non-secret runtime config the browser is allowed to see. Never put
 * secrets here — this is returned by GET /api/config and /api/health.
 *
 * Server-only (it reads process.env).
 */
import { blobToken, env, hasDatabase, isProduction, smsConfigured } from "@/lib/env";
import { aiConfigured, aiPublicInfo } from "@/lib/server/ai.server";

export type PublicRuntimeConfig = {
  /** Which social sign-in providers actually have credentials configured. */
  providers: { google: boolean; x: boolean };
  /** True when a real (persistent, shared) database is configured. */
  database: boolean;
  /** True when photo object storage is configured. */
  blob: boolean;
  /** True when real SMS delivery is configured (else the code shows on screen). */
  sms: boolean;
  /** True when a stable session secret is configured. */
  secret: boolean;
  /** Seed chat is backed by a configured AI provider (else canned replies). */
  ai: {
    configured: boolean;
    provider: string | null;
    label: string | null;
    model: string | null;
  };
  /** Whether the app is running in a deployed production environment. */
  production: boolean;
};

export function publicRuntimeConfig(): PublicRuntimeConfig {
  return {
    providers: {
      google: Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")),
      x: Boolean(
        (env("X_CLIENT_ID") ?? env("TWITTER_CLIENT_ID")) &&
          (env("X_CLIENT_SECRET") ?? env("TWITTER_CLIENT_SECRET")),
      ),
    },
    database: hasDatabase(),
    blob: Boolean(blobToken()),
    sms: smsConfigured(),
    secret: Boolean(env("BETTER_AUTH_SECRET") ?? env("AUTH_SECRET")),
    ai: { configured: aiConfigured(), ...aiPublicInfo() },
    production: isProduction(),
  };
}

/**
 * In a deployed/serverless environment the embedded PGlite fallback is NOT
 * viable: each function invocation can be a fresh isolate with its own empty,
 * ephemeral database, so sessions created in one request vanish in the next
 * (the symptom is random "unauthorized"). Production therefore REQUIRES a real
 * DATABASE_URL. Returns a human-readable problem string, or null when healthy.
 */
export function productionConfigProblem(): string | null {
  if (!isProduction()) return null;
  const missing: string[] = [];
  if (!hasDatabase()) {
    missing.push(
      "DATABASE_URL is not set — serverless has no persistent database, so " +
        "logins vanish between requests (random 'unauthorized'). Add a Postgres " +
        "database (e.g. Neon) and set DATABASE_URL.",
    );
  }
  if (!env("BETTER_AUTH_SECRET") && !env("AUTH_SECRET")) {
    missing.push(
      "BETTER_AUTH_SECRET is not set — set it to a stable random value " +
        "(openssl rand -hex 32) so sessions are valid across serverless isolates.",
    );
  }
  if (missing.length === 0) return null;
  return missing.join(" ");
}
