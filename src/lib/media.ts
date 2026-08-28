const MAX_EDGE = 1080;
const JPEG_QUALITY = 0.72;

/** Discreet placeholders are tiny on purpose: ~24px wide, a kilobyte or two. */
const BLUR_EDGE = 24;
const BLUR_QUALITY = 0.4;

export function isRemotePhoto(src: string) {
  return /^(https?:\/\/|\/photos\/|\/uploads\/)/i.test(src);
}

export function isDataPhoto(src: string) {
  return src.startsWith("data:image/");
}

/**
 * A single photo plus its discreet-mode placeholder.
 *
 * The two travel together everywhere, so `photos[i]` always has its blur at
 * `photoBlurs[i]`. Keeping them as parallel arrays (rather than objects of
 * `{src, blur}`) means every existing caller keeps working unchanged.
 */
export type UploadedPhoto = { url: string; blur: string };

function drawTo(bitmap: ImageBitmap, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process photo");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, width, height };
}

export async function fileToJpegBlob(
  file: File,
  maxSize = MAX_EDGE,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { canvas } = drawTo(bitmap, maxSize);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  bitmap.close?.();
  if (!blob) throw new Error("Could not process photo");
  return blob;
}

/**
 * A ~24px JPEG data URI used as the discreet-mode placeholder.
 *
 * This is what makes "discreet" real: the browser stores and renders *this*
 * until the viewer taps to reveal, so the full-resolution photo is never in the
 * DOM, never in the page source, and never reachable by right-click → Open
 * Image. A CSS blur over the real image would leave all three wide open.
 */
export async function fileToBlurPlaceholder(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { canvas } = drawTo(bitmap, BLUR_EDGE);
  // A heavy CSS blur on top of a 24px image: even at full scale the face is
  // unrecognisable, and the browser upscales it for free.
  const dataUrl = canvas.toDataURL("image/jpeg", BLUR_QUALITY);
  bitmap.close?.();
  return dataUrl;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(blob);
  });
}

/** Upload a (downscaled) JPEG blob; returns the stored URL and its placeholder. */
export async function uploadPhotoBlob(
  blob: Blob,
  blur: string,
  _filename = "photo.jpg",
): Promise<UploadedPhoto> {
  const image = await blobToDataUrl(blob);
  const res = await fetch("/api/media", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ image, blur }),
  });
  const payload = (await res.json().catch(() => null)) as
    | { url?: string; blur?: string; error?: string }
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
  return { url: payload.url, blur: payload.blur ?? "" };
}

/** Upload a file once, producing both the stored photo and its placeholder. */
export async function uploadPhotoFile(file: File): Promise<UploadedPhoto> {
  const [blob, blur] = await Promise.all([
    fileToJpegBlob(file),
    fileToBlurPlaceholder(file),
  ]);
  return uploadPhotoBlob(blob, blur, file.name.replace(/\.[^.]+$/, "") + ".jpg");
}

/**
 * Upload any not-yet-persisted (data URL) photos, leaving remote URLs as-is.
 * Placeholders are carried through positionally so the two arrays stay aligned.
 */
export async function persistPhotoList(
  photos: string[],
  blurs: string[] = [],
): Promise<{ photos: string[]; blurs: string[] }> {
  const outPhotos: string[] = [];
  const outBlurs: string[] = [];
  const list = photos.filter(Boolean).slice(0, 8);

  for (let i = 0; i < list.length; i++) {
    const src = list[i]!;
    const blur = blurs[i] ?? "";

    if (isRemotePhoto(src)) {
      outPhotos.push(src);
      // A remote photo must never fall back to a *remote* blur — that would
      // reintroduce the tracking-pixel leak. Accept a data-URI placeholder or
      // none at all.
      outBlurs.push(blur.startsWith("data:image/") ? blur : "");
      continue;
    }
    if (!isDataPhoto(src)) continue;

    const res = await fetch(src);
    const blob = await res.blob();
    const uploaded = await uploadPhotoBlob(blob, blur);
    outPhotos.push(uploaded.url);
    outBlurs.push(uploaded.blur);
  }

  return { photos: outPhotos, blurs: outBlurs };
}

/** Keep a blur array aligned to a photo array after a reorder/removal. */
export function alignBlurs(photos: string[], blurs: string[]): string[] {
  return photos.map((_, i) => (blurs[i] ?? "").startsWith("data:image/") ? blurs[i]! : "");
}
