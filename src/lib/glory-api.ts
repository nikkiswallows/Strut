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

export function claimServe(bullId: string) {
  return app<{ ok: true; pending: true }>("serveClaim", { bullId });
}

export function decideServe(serveId: number, approve: boolean) {
  return app<{ ok: true; approved: boolean }>("serveDecide", { serveId, approve });
}

export function releaseLock() {
  return app<{ ok: true; lock: LockSession | null }>("lockRelease");
}
