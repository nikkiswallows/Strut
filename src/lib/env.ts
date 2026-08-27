/**
 * Environment helpers shared by client-safe and server modules.
 *
 * The app is configured entirely through environment variables. Everything has
 * a safe local/preview fallback so `npm run dev` works with zero setup, while
 * production fails closed where a secret is genuinely required.
 */

/** Read an env var, treating empty/whitespace as unset. */
export function env(key: string): string | undefined {
  const value =
    typeof process !== "undefined" ? process.env[key]?.trim() : undefined;
  return value ? value : undefined;
}

/** True when a real production database is configured. */
export function hasDatabase(): boolean {
  return Boolean(env("DATABASE_URL"));
}

/**
 * The public origin of THIS app (no trailing slash), e.g.
 * `https://strut.example.com`. Used as Better Auth's base URL and to build
 * OAuth redirect URIs. Falls back to localhost for dev.
 */
export function appBaseUrl(): string {
  const explicit = env("BETTER_AUTH_URL") ?? env("APP_URL") ?? env("NEXTAUTH_URL");
  if (explicit) {
    try {
      return new URL(explicit.includes("://") ? explicit : `https://${explicit}`)
        .origin;
    } catch {
      /* fall through */
    }
  }
  const prod = env("VERCEL_PROJECT_PRODUCTION_URL");
  if (prod) {
    try {
      return new URL(prod.includes("://") ? prod : `https://${prod}`).origin;
    } catch {
      /* fall through */
    }
  }
  const preview = env("VERCEL_URL");
  if (preview) {
    try {
      return new URL(
        preview.includes("://") ? preview : `https://${preview}`,
      ).origin;
    } catch {
      /* fall through */
    }
  }
  return "http://localhost:8080";
}

/** Whether the app is running in a deployed production environment. */
export function isProduction(): boolean {
  return env("VERCEL") === "1" || env("NODE_ENV") === "production";
}

/** Whether real SMS delivery (Twilio) is configured. */
export function smsConfigured(): boolean {
  return Boolean(
    env("TWILIO_ACCOUNT_SID") &&
      env("TWILIO_AUTH_TOKEN") &&
      env("TWILIO_FROM_NUMBER"),
  );
}

/**
 * Vercel Blob object storage. ONE store is enough to scale very far: Blob is
 * CDN-fronted (reads never touch the app or DB) and content-addressed, so many
 * app instances can upload concurrently. Add a second store only if you want to
 * split media (e.g. photos vs. video) or hit a hard regional/per-project cap.
 */
export function blobToken(): string | undefined {
  return env("BLOB_READ_WRITE_TOKEN") ?? env("VERCEL_BLOB_READ_WRITE_TOKEN");
}
