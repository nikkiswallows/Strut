import { getSql } from "@/lib/db";

/**
 * Account lifecycle audit trail.
 *
 * Deletion and portability are legal obligations (GDPR / CCPA), and both reward
 * being able to *prove* you honoured them. This writer records the who/when of
 * destructive and data-export operations.
 *
 * Deliberately stores no message content, no photos and no identity documents —
 * an audit row must never itself become the leak. Never throws: audit logging
 * must never be the reason a user-facing request fails.
 */
export async function accountEvent(
  userId: string,
  kind:
    | "export"
    | "delete"
    | "age_attest"
    | "age_assure"
    | "block"
    | "unblock"
    | "report"
    | "seed_create"
    | "seed_purge"
    | "seed_edit"
    | "suspend"
    | "unsuspend"
    | "admin_bootstrap",
  detail?: Record<string, unknown>,
  request?: { ip?: string | null; userAgent?: string | null },
): Promise<void> {
  try {
    const sql = await getSql();
    await sql.query(
      `insert into account_events (user_id, kind, detail, ip, user_agent)
       values ($1, $2, $3::jsonb, $4, $5)`,
      [
        userId,
        kind,
        detail ? JSON.stringify(detail) : null,
        request?.ip ?? null,
        request?.userAgent ?? null,
      ],
    );
  } catch (err) {
    console.error("[audit] could not record", kind, err);
  }
}
