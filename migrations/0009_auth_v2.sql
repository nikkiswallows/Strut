-- Auth v2: direct, self-hosted Better Auth.
--
-- Replaces the sandbox-only "Grok broker" federation and the hand-rolled
-- `stk_` parallel token system with ONE supported identity layer:
--   * email + password (Better Auth credential accounts)
--   * Google / X direct OAuth (this app's own client id/secret)
--   * passwordless phone OTP (Better Auth phoneNumber plugin)
--
-- Sessions live solely in Better Auth's `session` table and are presented with
-- a standard HttpOnly, Secure, SameSite=Lax cookie (plus an optional Bearer
-- token for future native apps). Nothing is duplicated in localStorage.

-- Phone number is stored directly on the user by the phoneNumber plugin.
-- Phone-only accounts get a synthetic placeholder email UNTIL/UNLESS they add a
-- real one, so the existing NOT NULL UNIT UE email column keeps working.
alter table "user" add column if not exists "phoneNumber" text;
alter table "user" add column if not exists "phoneNumberVerified" boolean not null default false;

-- A user may have a phone but no real email yet. Relax the NOT NULL so
-- phone sign-up can insert first and backfill the synthetic email, then keep a
-- partial unique index so real emails stay unique (NULLs/synthetic never clash).
alter table "user" alter column "email" drop not null;
-- 0001 created `email ... unique`, which Postgres implements as a unique
-- CONSTRAINT named user_email_key (not a plain index). Drop the constraint if
-- present; tolerate environments where it was created as an index instead.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'user_email_key'
  ) then
    alter table "user" drop constraint "user_email_key";
  end if;
end $$;
drop index if exists "user_email_key";
create unique index if not exists "user_email_unique"
  on "user" ("email")
  where "email" is not null;
create unique index if not exists "user_phone_unique"
  on "user" ("phoneNumber")
  where "phoneNumber" is not null;

-- Backfill: mark any existing phone_identities mapping as verified users.
update "user" u
set "phoneNumber" = pi.phone_e164,
    "phoneNumberVerified" = true
from phone_identities pi
where pi.user_id = u.id and u."phoneNumber" is null;

-- The phoneNumber plugin stores OTP challenges in the shared verification
-- table (identifier = phone number, value = code). Ensure the index the plugin
-- benefits from exists (0001 already creates verification_identifier_idx).
create index if not exists "verification_expires_idx" on "verification" ("expiresAt");

-- Session hygiene: index + cleanup support for high-volume session table.
create index if not exists "session_expires_idx" on "session" ("expiresAt");
create index if not exists "account_provider_idx" on "account" ("providerId", "accountId");
