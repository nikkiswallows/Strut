/**
 * Photo URL allowlist (isomorphic — safe to import from client code).
 *
 * Deliberately NOT a `.server` module. The predicate is pure string/host
 * matching and is needed on both sides:
 *
 *  - server: reject profile saves whose `photos` point at attacker-controlled
 *    hosts (an off-site URL could be swapped after review, used to track which
 *    members viewed a profile, or used to serve an SVG that runs script on the
 *    storage domain);
 *  - client: `src/routes/index.tsx` renders the public landing strip from the
 *    same module that saves profiles, so a `.server` import here would drag
 *    `media.server` (and `pg`, and the storage token) into the browser bundle.
 *    TanStack Start's import-protection plugin fails the build on exactly that.
 */
import { allowedPhotoHosts, BLOB_PUBLIC_HOST_SUFFIX } from "@/lib/env";

export function isAllowedPhotoUrl(src: string): boolean {
  if (!src) return false;
  // Locally-generated placeholders and legacy dev rows.
  if (src.startsWith("data:image/")) return true;
  // Same-origin static/app paths.
  if (/^\/(photos|uploads)\//i.test(src)) return true;
  if (/^https?:\/\//i.test(src)) {
    try {
      const host = new URL(src).hostname.toLowerCase();
      if (host.endsWith(BLOB_PUBLIC_HOST_SUFFIX)) return true;
      if (allowedPhotoHosts().includes(host)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Loose legacy check — used when reading rows written before the allowlist. */
export function isStoredPhotoUrl(src: string) {
  return /^(https?:\/\/|\/photos\/|\/uploads\/|data:image\/)/i.test(src);
}

/**
 * Validate the discreet-mode blur placeholders that ride along with photos.
 * Pure string work, so it lives here next to the photo allowlist.
 */
export function cleanPhotoBlurs(value: unknown, photoCount: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, Math.max(0, photoCount))
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    // Strict: image/jpeg (or png/webp) base64 data URIs only, and small.
    .filter((entry) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(entry))
    .filter((entry) => entry.length <= 24_000);
}
