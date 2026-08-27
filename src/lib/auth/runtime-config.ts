/**
 * Client-side fetch of public runtime config (which providers/features are
 * wired). Cached for the lifetime of the page; safe to call from React.
 */
import type { PublicRuntimeConfig } from "./runtime-config.server";

let cache: PublicRuntimeConfig | null = null;
let inflight: Promise<PublicRuntimeConfig | null> | null = null;

export async function fetchRuntimeConfig(): Promise<PublicRuntimeConfig | null> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/config", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: PublicRuntimeConfig | null) => {
      cache = data;
      inflight = null;
      return data;
    })
    .catch(() => {
      inflight = null;
      return null;
    });
  return inflight;
}
