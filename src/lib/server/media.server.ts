import { randomUUID } from "node:crypto";
import {
  allowedPhotoHosts,
  BLOB_PUBLIC_HOST_SUFFIX,
  blobToken,
  isProduction,
} from "@/lib/env";

/**
 * Max upload size (2.5 MB after the client downscales to a 1080px JPEG).
 * Raise to support larger media; Vercel Blob handles the storage, the CDN
 * serves reads.
 */
const MAX_BYTES = 2_500_000;

/**
 * Sniff the real image type from magic bytes and ignore whatever the client
 * claimed. Passing the client's Content-Type through to Blob allowed arbitrary
 * types (text/html, image/svg+xml) to be hosted and served from the storage
 * domain — stored XSS on the Blob CDN subdomain plus free file hosting.
 */
export function sniffImageType(
  bytes: Uint8Array,
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Store a user photo and return its public URL.
 *
 * Production: Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Object keys are
 * content-addressed per user (`photos/<userId>/<ts>-<rand>.jpg`) with no random
 * suffix, so re-uploads are idempotent and deletes are predictable. Reads are
 * served straight from the Blob CDN — they never touch the app or database, so
 * a single Blob store scales to very high traffic. Add a SECOND store only to
 * split media classes (photos vs. video) or to satisfy a regional requirement.
 *
 * Dev/preview with no token: a compact data URL so local PGlite keeps working.
 */
export async function storePhotoObject(input: {
  userId: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<string> {
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new Error("That photo is too large. Use a smaller shot.");
  }
  // Only real JPEG/PNG/WebP bytes are accepted; the stored Content-Type is
  // decided by the sniffed bytes, never by the client.
  const sniffed = sniffImageType(input.bytes);
  if (!sniffed) {
    throw new Error("Photos must be JPEG, PNG, or WebP images.");
  }
  const token = blobToken();
  const key = `photos/${input.userId}/${Date.now()}-${randomUUID().slice(0, 8)}.jpg`;

  if (token) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, Buffer.from(input.bytes), {
      access: "public",
      token,
      contentType: sniffed,
      addRandomSuffix: false,
      cacheControlMaxAge: 31_536_000, // immutable: key changes on every new upload
    });
    return blob.url;
  }

  // No Blob token.
  if (isProduction()) {
    throw new Error(
      "Photo storage is not configured. Create a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.",
    );
  }
  if (input.bytes.byteLength > 180_000) {
    throw new Error(
      "Photo storage is not configured for large files. Add a Vercel Blob store (BLOB_READ_WRITE_TOKEN).",
    );
  }
  return `data:image/jpeg;base64,${Buffer.from(input.bytes).toString("base64")}`;
}

/**
 * True for a photo URL this app is willing to store on a profile.
 *
 * `isStoredPhotoUrl` below is the *loose* check (any http(s) URL) kept for
 * reading back legacy rows. This is the strict one used on write.
 *
 * Why it matters: a profile that can store any http(s) URL can store a
 * tracking pixel. Every member whose deck loads that card then leaks their IP,
 * user agent and referer to whoever controls that host — a deanonymization
 * primitive aimed at a closeted audience, and effectively free to deploy.
 * Photos are therefore restricted to this app's own paths, the Vercel Blob CDN
 * host, and hosts explicitly allowlisted via PHOTO_HOST_ALLOWLIST.
 */
// Re-exported from the isomorphic module so server and client share one
// allowlist. See src/lib/photo-url.ts for why this file must not define it.
export { cleanPhotoBlurs, isAllowedPhotoUrl, isStoredPhotoUrl } from "@/lib/photo-url";

/**
 * Validate the discreet-mode blur placeholders that ride along with photos.
 *
 * Each entry is a ~24px JPEG data URI generated in the browser (1–2 KB), never
 * a remote URL — a remote "blur" would reintroduce the tracking-pixel leak the
 * allowlist above exists to prevent.
 */
