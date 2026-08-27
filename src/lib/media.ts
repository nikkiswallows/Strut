const MAX_EDGE = 1080;
const JPEG_QUALITY = 0.72;

export function isRemotePhoto(src: string) {
  return /^(https?:\/\/|\/photos\/|\/uploads\/)/i.test(src);
}

export function isDataPhoto(src: string) {
  return src.startsWith("data:image/");
}

export async function fileToJpegBlob(
  file: File,
  maxSize = MAX_EDGE,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process photo");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("Could not process photo");
  return blob;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(blob);
  });
}

/** Upload a (downscaled) JPEG blob; returns the stored URL (Vercel Blob). */
export async function uploadPhotoBlob(
  blob: Blob,
  _filename = "photo.jpg",
): Promise<string> {
  const image = await blobToDataUrl(blob);
  const res = await fetch("/api/media", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ image }),
  });
  const payload = (await res.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;
  if (res.status === 401) {
    throw new Error(
      "Your session wasn’t recognized. Sign in again, then retry the photo. " +
        "(If it keeps happening, the server may be missing DATABASE_URL — " +
        "sessions don’t persist between serverless requests without a real database.)",
    );
  }
  if (!res.ok || !payload?.url) {
    throw new Error(payload?.error || "Could not upload that photo.");
  }
  return payload.url;
}

export async function uploadPhotoFile(file: File): Promise<string> {
  const blob = await fileToJpegBlob(file);
  return uploadPhotoBlob(
    blob,
    file.name.replace(/\.[^.]+$/, "") + ".jpg",
  );
}

/** Persist any not-yet-uploaded (data URL) photos, leaving remote URLs as-is. */
export async function persistPhotoList(photos: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const src of photos.filter(Boolean).slice(0, 8)) {
    if (isRemotePhoto(src)) {
      out.push(src);
      continue;
    }
    if (!isDataPhoto(src)) continue;
    const res = await fetch(src);
    const blob = await res.blob();
    out.push(await uploadPhotoBlob(blob));
  }
  return out;
}
