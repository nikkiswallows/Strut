/**
 * Age gating (shared by client and server).
 *
 * Strut ships explicit adult content. As of August 2026, 27 US states require
 * commercial sites whose content is "sexual material harmful to minors" to
 * verify age, the Supreme Court has upheld that requirement
 * (Free Speech Coalition v. Paxton, 606 U.S. 461), and a self-declared
 * checkbox satisfies none of the regimes.
 *
 * This module is the *first* layer: an immutable, server-validated date of
 * birth. It is not sufficient on its own for the regulated states — that needs
 * a third-party age-assurance provider (see `age_assurance_*` columns) — but
 * without it there is nothing to verify against and nothing to audit.
 *
 * Rules enforced here:
 *   - a birth date is required to create a profile at all
 *   - it must parse, be in the past, and put the member at/over MIN_AGE
 *   - it is immutable once attested (there is no "edit your birthday" path)
 *   - the plausible range is bounded so a typo can't create a 200-year-old
 */
export const MIN_AGE = 18;
/** Below this the account is rejected outright rather than merely ungated. */
export const HARD_MIN_AGE = 18;
const MAX_AGE = 120;

export type AgeCheck =
  | { ok: true; birthDate: string; age: number }
  | { ok: false; error: string };

/** Normalise a `YYYY-MM-DD` string, or null when it isn't one. */
export function normalizeBirthDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible calendar dates (e.g. 2025-02-30 rolls over in JS).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Whole years between a birth date and a reference date (UTC, no drift). */
export function ageOn(birthDate: string, at: Date = new Date()): number {
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  let age = at.getUTCFullYear() - y;
  const beforeBirthday =
    at.getUTCMonth() + 1 < m || (at.getUTCMonth() + 1 === m && at.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Full validation. Returns the normalized birth date and current age, or a
 * message safe to show the member (no enumeration value, no PII in the error).
 */
export function checkBirthDate(value: unknown, at: Date = new Date()): AgeCheck {
  if (value == null || (typeof value === "string" && !value.trim())) {
    return { ok: false, error: "Enter your date of birth to continue." };
  }
  const birthDate = normalizeBirthDate(value);
  if (!birthDate) {
    return { ok: false, error: "That date isn't valid. Use YYYY-MM-DD." };
  }
  const start = Date.parse(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(start) || start > at.getTime()) {
    return { ok: false, error: "Birth date must be in the past." };
  }
  const age = ageOn(birthDate, at);
  if (age < 0 || age > MAX_AGE) {
    return { ok: false, error: "Check that birth date — it looks off." };
  }
  if (age < HARD_MIN_AGE) {
    // Deliberately non-specific and non-collecting: we do not store the
    // attempt, we do not say how far under they are, and we do not offer a
    // "come back later" path that would imply we kept the data.
    return { ok: false, error: "Strut is strictly 18+. You cannot create an account." };
  }
  return { ok: true, birthDate, age };
}

/** Convenience for read-only display paths. */
export function isAdult(birthDate: string | null | undefined, at: Date = new Date()): boolean {
  if (!birthDate) return false;
  const normalized = normalizeBirthDate(birthDate);
  if (!normalized) return false;
  return ageOn(normalized, at) >= MIN_AGE;
}
