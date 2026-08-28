/**
 * Minimal in-memory per-user rate limiter (server-only).
 *
 * Good enough to stop a single account from scripting an endpoint into a cost
 * or spam problem. Caveat: on serverless each isolate keeps its own buckets,
 * so the effective limit is per-isolate (roughly "per warm instance"), not
 * global. That is fine for launch; swap the Map for Upstash Redis when real
 * global limits matter.
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

/** Periodically drop expired buckets so the map cannot grow unbounded. */
export function sweepRateBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}
