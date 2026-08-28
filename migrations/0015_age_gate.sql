-- 0015 — age gate (date of birth + assurance bookkeeping).
--
-- Strut ships explicit adult content. Before this migration the app never
-- learned a member's age: `profiles.age` was a free number, nullable, and only
-- clamped *if supplied*. There was nothing to enforce and nothing to audit.
--
-- As of August 2026, 27 US states require commercial sites whose content is
-- "sexual material harmful to minors" to verify age, and the Supreme Court
-- settled the constitutional question in Free Speech Coalition v. Paxton
-- (606 U.S. 461, June 2025) — "adults have no First Amendment right to avoid
-- age verification." A self-declared checkbox satisfies none of these regimes.
--
-- This migration adds the primitive the gate needs. The *assurance* step (ID
-- / transactional / digital-ID check through a third party) is a separate
-- integration; `age_assurance` records that an assurance check happened, at
-- what level, and — critically — stores NO identity document. Statutes
-- uniformly require prompt deletion of verification material, so none is kept.

alter table profiles add column if not exists birth_date date;

-- When the member attested their birth date, and what they attested.
alter table profiles add column if not exists age_attested_at timestamptz;

-- Third-party age assurance (nullable until an assurance provider is wired).
--   level:  null | 'self' | 'assured'
--   method: e.g. 'id_document', 'transactional', 'digital_id', 'self_attest'
--   reference: the provider's opaque check id (NOT the document, NOT the DOB)
alter table profiles add column if not exists age_assurance_level text;
alter table profiles add column if not exists age_assurance_method text;
alter table profiles add column if not exists age_assurance_at timestamptz;
alter table profiles add column if not exists age_assurance_ref text;

-- Keep the check honest: only the three supported levels.
alter table profiles drop constraint if exists profiles_age_assurance_level_chk;
alter table profiles add constraint profiles_age_assurance_level_chk
  check (age_assurance_level is null or age_assurance_level in ('self', 'assured'));

-- Enforce the adult-only rule at the storage layer as well as in the app, so a
-- future code path cannot accidentally write a minor's profile. A NULL
-- birth_date is still allowed (legacy rows) but is treated as "not yet gated"
-- by the application and blocks onboarding.
alter table profiles drop constraint if exists profiles_adult_only_chk;
alter table profiles add constraint profiles_adult_only_chk
  check (birth_date is null or birth_date <= (current_date - interval '18 years')::date);

-- Reporting / compliance lookup: who is gated and who is not.
create index if not exists profiles_birth_date_idx on profiles (birth_date);
create index if not exists profiles_age_assurance_idx
  on profiles (age_assurance_level)
  where age_assurance_level is not null;
