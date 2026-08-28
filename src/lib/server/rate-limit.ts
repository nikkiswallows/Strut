/**
 * Minimal in-memory per-key rate limiter (server-only).
 *
 * Good enough to stop a single account from scripting an endpoint into a cost,
 * abuse, or spam problem. Caveat: on serverless each isolate keeps its own
 * buckets, so the effective limit is per-isolate (roughly "per warm instance"),
 * not global. That is fine for launch; swap the Map for Upstash Redis when real
 * global limits matter — `rateLimit`/`cooldown` keep the same signatures.
 *
 * Two primitives:
 *   rateLimit(key, limit, windowMs)  — "at most N per window" (sliding-ish)
 *   cooldown(key, ms)                — "not again until the window passes",
 *                                      returns the seconds remaining so the UI
 *                                      can show a truthful countdown instead of
 *                                      a hardcoded one.
 */
type Bucket = { count: number; resetAt: number };

const globalRef = globalThis as typeof globalThis & {
  __strutRateBuckets__?: Map<string, Bucket>;
};
const buckets = (globalRef.__strutRateBuckets__ ??= new Map<string, Bucket>());

/** Returns true when the action is allowed. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/**
 * "Not again until `windowMs` has passed since the last allowed call."
 * Returns `{ ok: true }` and arms the window, or `{ ok: false, retryAfter }`
 * with the whole seconds remaining.
 */
export function cooldown(
  key: string,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

/** Peek at a cooldown without consuming it (for honest UI countdowns). */
export function cooldownRemaining(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket) return 0;
  const remaining = bucket.resetAt - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/**
 * Best-effort client IP for an unauthenticated endpoint.
 *
 * Vercel sets `x-real-ip` / `x-vercel-forwarded-for` / `x-forwarded-for` at the
 * edge and they cannot be spoofed by the browser's JS, so they are safe enough
 * for abuse limiting (never for authorization). Falls back to "unknown", which
 * deliberately shares one bucket rather than pretending to know the caller.
 */
export function clientIp(request: Request): string {
  const headers = [
    "x-real-ip",
    "x-vercel-forwarded-for",
    "cf-connecting-ip",
    "true-client-ip",
  ];
  for (const key of headers) {
    const value = request.headers.get(key)?.split(",")[0]?.trim();
    if (value) return value;
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "unknown";
}

/** Periodically drop expired buckets so the map cannot grow unbounded. */
export function sweepRateBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}
