import { app } from "./http";
import type { GloryBoard, LockSession } from "./types";

export function fetchGlory() {
  return app<GloryBoard>("glory");
}

export function startLock(input: { pledgeHours?: number | null; note?: string | null }) {
  return app<{ ok: true; lock: LockSession }>("lockStart", {
    pledgeHours: input.pledgeHours ?? null,
    note: input.note ?? null,
  });
}

export function releaseLock() {
  return app<{ ok: true; lock: LockSession | null }>("lockRelease");
}
