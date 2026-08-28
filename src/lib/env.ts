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

/**
 * Whether real SMS delivery (Twilio) is configured.
 *
 * A sender is required in one of two forms: a plain `TWILIO_FROM_NUMBER` in
 * E.164, or a `TWILIO_MESSAGING_SERVICE_SID` (preferred for US A2P 10DLC —
 * it handles sender selection, STOP/HELP keywords and carrier routing).
 */
export function smsConfigured(): boolean {
  const sender = env("TWILIO_FROM_NUMBER") ?? env("TWILIO_MESSAGING_SERVICE_SID");
  return Boolean(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && sender);
}

/**
 * Twilio's public REST base. Override for a regional edge, or to point the
 * integration at a local mock while testing. Trailing slashes are stripped.
 */
export function twilioApiBase(): string {
  return (env("TWILIO_API_BASE") ?? "https://api.twilio.com").replace(/\/+$/, "");
}

/**
 * Extra hosts a profile photo URL may point at (comma separated).
 *
 * A profile that can store *any* http(s) URL can store a tracking pixel: every
 * member whose deck loads that card then leaks their IP and user agent to a
 * third party. For a closeted audience that is a deanonymization primitive, so
 * photos are restricted to this app's own paths, the blob CDN host, and any
 * host explicitly allowlisted here.
 */
export function allowedPhotoHosts(): string[] {
  return (env("PHOTO_HOST_ALLOWLIST") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Vercel Blob's public CDN suffix (reads never touch the app). */
export const BLOB_PUBLIC_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * Vercel Blob object storage. ONE store is enough to scale very far: Blob is
 * CDN-fronted (reads never touch the app or DB) and content-addressed, so many
 * app instances can upload concurrently. Add a second store only if you want to
 * split media (e.g. photos vs. video) or hit a hard regional/per-project cap.
 */
export function blobToken(): string | undefined {
  return env("BLOB_READ_WRITE_TOKEN") ?? env("VERCEL_BLOB_READ_WRITE_TOKEN");
}
