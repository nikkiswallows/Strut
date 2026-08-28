/**
 * Lightweight in-process pub/sub used to push server-side events to live clients
 * over SSE. Tracks listeners by channel. State lives on `globalThis` so Vite's
 * HMR (which creates new module instances) shares one bus instead of leaking a
 * broken emitter per reload.
 *
 * Deployment note: this is per-instance, which is perfect for a single dev /
 * preview server and for a warm serverless instance. On a truly multi-instance
 * Vercel deployment you'd back the bus with Redis pub/sub (same API) so events
 * fan out across instances. The client treats the stream as a hint and still
 * refetches, so a missed event degrades to a short poll, never a stale thread.
 */
export type RealtimeEvent = {
  channel: string;
  type: string;
  payload?: unknown;
};

type Listener = (event: RealtimeEvent) => void;

const globalRef = globalThis as typeof globalThis & {
  __strutRealtimeChannels__?: Map<string, Set<Listener>>;
};

function channels(): Map<string, Set<Listener>> {
  globalRef.__strutRealtimeChannels__ ??= new Map();
  return globalRef.__strutRealtimeChannels__;
}

/** Subscribe to a channel; returns an unsubscribe function. */
export function subscribe(channel: string, listener: Listener): () => void {
  const map = channels();
  let set = map.get(channel);
  if (!set) {
    set = new Set();
    map.set(channel, set);
  }
  set.add(listener);
  return () => unsubscribe(channel, listener);
}

/** Remove a specific listener from a channel (used on stream teardown). */
export function unsubscribe(channel: string, listener: Listener): void {
  const set = channels().get(channel);
  set?.delete(listener);
  if (set && set.size === 0) channels().delete(channel);
}

/** Publish an event to every listener on a channel. Never throws. */
export function publish(channel: string, event: Omit<RealtimeEvent, "channel">): void {
  const set = channels().get(channel);
  if (!set || set.size === 0) return;
  for (const listener of [...set]) {
    try {
      listener({ ...event, channel });
    } catch {
      // A broken listener must not break the publish.
    }
  }
}
