import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { rateLimit, sweepRateBuckets } from "@/lib/server/rate-limit";
import { accountEvent } from "./audit";

/**
 * Trust & safety: blocks and reports.
 *
 * Before this existed the app had no way for a member to stop a harasser, and
 * no way to tell the operator about one. For any dating app that is a gap; for
 * one serving a closeted and married audience — where an unwanted contact can
 * be a catastrophic, life-altering event — it is the difference between a
 * product and a liability. It is also the surface every adult-compliant payment
 * processor asks to see before underwriting you.
 *
 * Blocks are SYMMETRICAL. If either side blocks, neither appears in the other's
 * deck, likes, or inbox. That matters: a one-directional block still lets the
 * blocked account keep watching the person who blocked them, which is precisely
 * the behaviour a block exists to stop.
 */

export type BlockRow = { user_id: string; handle: string; display_name: string; photos: unknown };

/**
 * Every user id the viewer must not be able to see — both people they blocked
 * and people who blocked them.
 */
export async function blockedIdSet(userId: string): Promise<Set<string>> {
  const sql = await getSql();
  const rows = await sql.query<{ a: string; b: string }>(
    `select blocker_id as a, blocked_id as b from blocks
     where blocker_id = $1 or blocked_id = $1`,
    [userId],
  );
  const out = new Set<string>();
  for (const row of rows) {
    if (row.a !== userId) out.add(row.a);
    if (row.b !== userId) out.add(row.b);
  }
  return out;
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select 1 as n from blocks
     where (blocker_id = $1 and blocked_id = $2)
        or (blocker_id = $2 and blocked_id = $1)
     limit 1`,
    [a, b],
  );
  return rows.length > 0;
}

/** Throw a caller-safe error when an interaction crosses a block. */
export async function assertNotBlocked(a: string, b: string): Promise<void> {
  if (await isBlockedEitherWay(a, b)) {
    throw new Error("You can't interact with this member.");
  }
}

export async function blockUserFor(userId: string, targetId: string) {
  if (!targetId || targetId === userId) throw new Error("That isn't someone you can block.");
  const sql = await getSql();
  await sql.query(
    `insert into blocks (blocker_id, blocked_id) values ($1, $2)
     on conflict (blocker_id, blocked_id) do nothing`,
    [userId, targetId],
  );
  // A block also clears the social graph in both directions, so a blocked
  // account does not linger in "likes" or "matches".
  await sql.query(
    `delete from likes
     where (from_user_id = $1 and to_user_id = $2)
        or (from_user_id = $2 and to_user_id = $1)`,
    [userId, targetId],
  );
  await sql.query(
    `delete from follows
     where (follower_id = $1 and following_id = $2)
        or (follower_id = $2 and following_id = $1)`,
    [userId, targetId],
  );
  await accountEvent(userId, "block", { targetId });
  return { blocked: true };
}

export async function unblockUserFor(userId: string, targetId: string) {
  const sql = await getSql();
  await sql.query(
    `delete from blocks where blocker_id = $1 and blocked_id = $2`,
    [userId, targetId],
  );
  await accountEvent(userId, "unblock", { targetId });
  return { blocked: false };
}

export async function listBlocksFor(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{
    user_id: string;
    handle: string;
    display_name: string;
    photos: unknown;
    created_at: string;
  }>(
    `select p.user_id, p.handle, p.display_name, p.photos, b.created_at
     from blocks b
     join profiles p on p.user_id = b.blocked_id
     where b.blocker_id = $1
     order by b.created_at desc`,
    [userId],
  );
  return rows.map((row) => ({
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name,
    photo: ((): string | null => {
      try {
        const parsed = JSON.parse(String(row.photos)) as unknown;
        return Array.isArray(parsed) && parsed.length ? String(parsed[0]) : null;
      } catch {
        return null;
      }
    })(),
    createdAt: String(row.created_at),
  }));
}

const REPORT_REASONS = [
  "Under 18",
  "Non-consensual / intimate image",
  "Harassment or threats",
  "Impersonation",
  "Spam or solicitation",
  "Illegal content",
  "Something else",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

export { REPORT_REASONS };

/**
 * File a report. Reports are never deduplicated away silently and never shown
 * to the reported party. NCII ("non-consensual intimate image") is tagged at
 * intake so it can be escalated inside the takedown SLA rather than sitting in
 * a general queue.
 */
export async function reportUserFor(
  userId: string,
  input: { targetId: string; reason: string; detail?: string; conversationId?: number | null },
) {
  const targetId = String(input.targetId ?? "");
  if (!targetId) throw new Error("Pick someone to report.");
  if (targetId === userId) throw new Error("You can't report yourself.");
  const reason = isReportReason(input.reason)
    ? input.reason
    : input.reason?.trim()
      ? "Something else"
      : null;
  if (!reason) throw new Error("Choose a reason.");

  const sql = await getSql();
  const rows = await sql.query<{ id: number; priority: string }>(
    `insert into reports (reporter_id, reported_id, reason, detail, conversation_id, status)
     values ($1, $2, $3, $4, $5, 'open')
     returning id`,
    [
      userId,
      targetId,
      reason,
      (input.detail ?? "").trim().slice(0, 1000) || null,
      input.conversationId ?? null,
    ],
  );
  await accountEvent(userId, "report", { targetId, reason, reportId: rows[0]?.id });
  return {
    reported: true,
    reportId: Number(rows[0]?.id ?? 0),
    // Shown to the reporter so a real report feels acknowledged, not swallowed.
    note:
      reason === "Non-consensual / intimate image" || reason === "Under 18"
        ? "Flagged for priority review. We act on these within 48 hours."
        : "Thanks. A moderator will review this.",
  };
}

// ── Server functions ───────────────────────────────────────────────────────

export const blockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((targetId: string) => String(targetId ?? ""))
  .handler(async ({ context, data: targetId }) => blockUserFor(context.userId, targetId));

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((targetId: string) => String(targetId ?? ""))
  .handler(async ({ context, data: targetId }) => unblockUserFor(context.userId, targetId));

export const listBlocks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listBlocksFor(context.userId));

export const reportUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      targetId: string;
      reason: string;
      detail?: string;
      conversationId?: number | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    // Reporting is cheap and must never be rate-limited to the point of
    // silencing someone mid-incident — but it does need *some* ceiling.
    sweepRateBuckets();
    if (!rateLimit(`report:${context.userId}`, 30, 60 * 60 * 1000)) {
      throw new Error("You've sent a lot of reports. Give us a moment to catch up.");
    }
    return reportUserFor(context.userId, data);
  });
