import { randomUUID } from "node:crypto";
import { blobToken, isProduction } from "@/lib/env";

/**
 * Max upload size (2.5 MB after the client downscales to a 1080px JPEG).
 * Raise to support larger media; Vercel Blob handles the storage, the CDN
 * serves reads.
 */
const MAX_BYTES = 2_500_000;

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
  const token = blobToken();
  const key = `photos/${input.userId}/${Date.now()}-${randomUUID().slice(0, 8)}.jpg`;

  if (token) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, Buffer.from(input.bytes), {
      access: "public",
      token,
      contentType: input.contentType || "image/jpeg",
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

export function isStoredPhotoUrl(src: string) {
  return /^(https?:\/\/|\/photos\/|\/uploads\/|data:image\/)/i.test(src);
}
