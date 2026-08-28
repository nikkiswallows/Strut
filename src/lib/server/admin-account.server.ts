/**
 * Admin identity: who counts as an admin, and the one-time bootstrap that makes
 * the configured admin login actually exist and be usable.
 *
 * Two decisions worth explaining.
 *
 * 1. **Admins are identified by email, not by a role column.** A role column
 *    needs a migration, a way to set it, and a UI to manage it — none of which
 *    earn their keep for a single-operator cold-start tool. An allowlist read
 *    from the environment cannot be escalated into from inside the app: there
 *    is no code path anywhere that writes it. `ADMIN_IDS` (user ids) is still
 *    honoured for the preview sandbox's synthetic `dev-user`.
 *
 * 2. **The account is created by writing Better Auth's own tables**, using its
 *    own password hasher via `auth.$context`, rather than by calling
 *    `signUpEmail`. Sign-up goes through rate limits, hooks and the phone
 *    plugin's temp-email logic, and it fails outright if the row already
 *    exists — none of which is what a boot-time idempotent bootstrap wants.
 *    Hashing is still Better Auth's, so the credential verifies through the
 *    normal sign-in path with no special casing.
 *
 * The bootstrap is idempotent and safe to call on every request: it memoises a
 * single promise per process and re-runs only if that promise rejected.
 */
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import type { SessionUser } from "@/lib/auth/session.server";
import {
  ADMIN_DISPLAY_NAME,
  FALLBACK_ADMIN_EMAIL,
  FALLBACK_ADMIN_PASSWORD,
} from "./secrets.server";

/* ── who is an admin ─────────────────────────────────────────────────────── */

function envList(key: string): string[] {
  return (process.env[key] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Emails allowed into the console (lowercased). */
export function adminEmails(): string[] {
  const configured = [...envList("ADMIN_EMAILS"), ...envList("ADMIN_EMAIL")];
  const list = configured.length ? configured : [FALLBACK_ADMIN_EMAIL];
  return list.map((e) => e.toLowerCase());
}

/** The password the bootstrapped admin account is created with. */
export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || FALLBACK_ADMIN_PASSWORD;
}

/** Extra user ids allowed in — used by the preview sandbox's `dev-user`. */
export function adminIds(): string[] {
  return envList("ADMIN_IDS");
}

/**
 * The console is always reachable because an admin login always exists (see
 * the bootstrap below). Set `ADMIN_DISABLED=1` to remove the surface entirely
 * — the route then 404s exactly as it did when it was env-gated.
 */
export function adminEnabled(): boolean {
  return process.env.ADMIN_DISABLED?.trim() !== "1";
}

export function isAdminUser(user: Pick<SessionUser, "id" | "email"> | null): boolean {
  if (!user) return false;
  if (adminIds().includes(user.id)) return true;
  const email = user.email?.trim().toLowerCase();
  return Boolean(email && adminEmails().includes(email));
}

export class ForbiddenError extends Error {
  readonly status = 403;
}

/* ── bootstrap ───────────────────────────────────────────────────────────── */

const globalRef = globalThis as typeof globalThis & {
  __strutAdminBootstrap__?: Promise<AdminBootstrapResult>;
};

export type AdminBootstrapResult = {
  userId: string;
  email: string;
  created: boolean;
  passwordReset: boolean;
};

/** Idempotent; memoised per process, retried on failure. */
export async function ensureAdminAccount(): Promise<AdminBootstrapResult> {
  if (!globalRef.__strutAdminBootstrap__) {
    globalRef.__strutAdminBootstrap__ = bootstrapAdmin().catch((err) => {
      globalRef.__strutAdminBootstrap__ = undefined;
      throw err;
    });
  }
  return globalRef.__strutAdminBootstrap__;
}

async function bootstrapAdmin(): Promise<AdminBootstrapResult> {
  const email = adminEmails()[0]!;
  const password = adminPassword();
  const sql = await getSql();

  // Better Auth's configured hasher (scrypt by default). Using it here means
  // the credential we write verifies through the ordinary sign-in path.
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  const existing = await sql.query<{ id: string }>(
    `select "id" from "user" where lower("email") = lower($1) limit 1`,
    [email],
  );

  let userId = existing[0]?.id ?? "";
  let created = false;

  if (!userId) {
    userId = `admin-${randomUUID()}`;
    await sql.query(
      `insert into "user" ("id","name","email","emailVerified","image","createdAt","updatedAt")
       values ($1,$2,$3,true,null,now(),now())`,
      [userId, ADMIN_DISPLAY_NAME, email],
    );
    created = true;
  }

  // Credential account row. Better Auth stores one `account` row per provider;
  // for email+password the providerId is 'credential' and accountId is the
  // user id.
  const account = await sql.query<{ id: string; password: string | null }>(
    `select "id","password" from "account"
     where "userId" = $1 and "providerId" = 'credential' limit 1`,
    [userId],
  );

  let passwordReset = false;
  if (!account[0]) {
    await sql.query(
      `insert into "account" ("id","accountId","providerId","userId","password","createdAt","updatedAt")
       values ($1,$2,'credential',$3,$4,now(),now())`,
      [randomUUID(), userId, userId, hash],
    );
    passwordReset = true;
  } else if (!(await ctx.password.verify({ hash: account[0].password ?? "", password }))) {
    // The configured password changed (or the row was created without one).
    // Re-sync so the documented credential always works — this console is the
    // only way back in, and locking the operator out of it is worse than the
    // (already accepted) risk of a known password.
    await sql.query(`update "account" set "password" = $2, "updatedAt" = now() where "id" = $1`, [
      account[0].id,
      hash,
    ]);
    passwordReset = true;
  }

  await ensureAdminProfile(userId);

  return { userId, email, created, passwordReset };
}

/**
 * Give the admin an onboarded, approved profile row.
 *
 * Without one, signing in as the admin lands on /onboarding and every
 * profile-shaped query returns null for them. It is marked `is_seed` so it
 * never counts as a real member in analytics, and it is NOT `is_ai` — it is a
 * staff account, not generated content. `suspended = true` keeps it out of
 * every member-facing deck, grid and search result while leaving the account
 * fully able to sign in and operate the console.
 */
async function ensureAdminProfile(userId: string): Promise<void> {
  const sql = await getSql();
  const birthDate = new Date(Date.now() - 35 * 365.25 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  await sql.query(
    `insert into profiles (
       user_id, handle, display_name, age, bio, location, onboarded, is_seed,
       identities, pronoun_list, looking_for_list, photos, interests, photo_blurs,
       birth_date, age_attested_at, suspended, last_active, created_at
     ) values (
       $1, $2, $3, 35, $4, 'Los Angeles, CA', true, true,
       '["Admin"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
       $5::date, now(), true, now(), now()
     )
     on conflict (user_id) do update set
       onboarded = true,
       suspended = true,
       display_name = excluded.display_name,
       last_active = now()`,
    [
      userId,
      adminHandle(),
      ADMIN_DISPLAY_NAME,
      "Operator account. Not a member profile — hidden from discovery.",
      birthDate,
    ],
  );
}

function adminHandle(): string {
  return (process.env.ADMIN_HANDLE?.trim() || "strutadmin")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}
