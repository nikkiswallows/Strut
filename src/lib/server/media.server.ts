import { randomUUID } from "node:crypto";

const MAX_BYTES = 2_500_000;

export async function storePhotoObject(input: {
  userId: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<string> {
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new Error("That photo is too large. Use a smaller shot.");
  }
  const token = (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN || "").trim();
  const key = `photos/${input.userId}/${Date.now()}-${randomUUID().slice(0, 8)}.jpg`;
  if (token) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, Buffer.from(input.bytes), {
      access: "public",
      token,
      contentType: input.contentType || "image/jpeg",
      addRandomSuffix: false,
    });
    return blob.url;
  }
  // Dev / preview fallback: keep a compact data URL so local PGLite still works.
  // Production on Vercel must set BLOB_READ_WRITE_TOKEN — data URLs will not scale.
  if (process.env.VERCEL && process.env.NODE_ENV === "production") {
    throw new Error(
      "Photo storage is not configured. Add a Vercel Blob store and BLOB_READ_WRITE_TOKEN.",
    );
  }
  if (input.bytes.byteLength > 180_000) {
    throw new Error("Photo storage is not configured for large files. Add Vercel Blob.");
  }
  return `data:image/jpeg;base64,${Buffer.from(input.bytes).toString("base64")}`;
}

export function isStoredPhotoUrl(src: string) {
  return /^(https?:\/\/|\/photos\/|\/uploads\/|data:image\/)/i.test(src);
}
