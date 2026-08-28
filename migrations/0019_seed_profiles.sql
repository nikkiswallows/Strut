-- 0019 — admin seed-profile generator (test-only tooling).
--
-- A personas-to-profile pipeline: the admin types a persona ("white sissy
-- bottom, 32, Orange County"), an uncensored Horde text model writes the bio
-- and fills the profile fields, a Horde image model renders one photo, and
-- NOTHING is created until a human clicks approve.
--
-- Two invariants are enforced by the schema, not by convention:
--
--  1. `profiles.is_ai` is non-negotiable. Every generated profile carries the
--     model, prompt and job id that produced it in `profiles.ai_seed`, so a
--     reviewer can audit origin and a single statement can purge the lot.
--     Undisclosed synthetic profiles on a dating app are a straightforward
--     FTC Section 5 deception problem (see FTC v. JDI Dating, the "virtual
--     Cupids" case) — the flag is what keeps us on the right side of that.
--
--  2. Drafts live in `seed_jobs` and are inert. A profile row only appears on
--     explicit approval, so a bad generation can never reach a member's deck.

alter table profiles add column if not exists is_ai    boolean not null default false;
alter table profiles add column if not exists ai_seed  jsonb;

create index if not exists profiles_is_ai_idx on profiles (is_ai) where is_ai;

-- Draft queue: one row per generation attempt.
create table if not exists seed_jobs (
  id              serial primary key,
  -- What the admin typed. Kept verbatim — it is the audit record.
  persona         text        not null,
  -- Structured profile fields the text model produced (handle, bio, age,
  -- identities, looking_for, location, interests, …). Null until generated.
  draft           jsonb,
  -- Horde ids for the async text / image jobs.
  text_horde_id   text,
  image_horde_id  text,
  -- 'drafting' -> 'awaiting_review' -> 'approved' | 'discarded' | 'failed'
  status          text        not null default 'drafting'
                  check (status in ('drafting', 'awaiting_review',
                                    'approved', 'discarded', 'failed')),
  -- Provenance: which models actually served the job, and the image prompt
  -- derived from the persona.
  text_model      text,
  image_model     text,
  image_prompt    text,
  image_url       text,
  image_censored  boolean     not null default false,
  error           text,
  -- Set when approved: the profile this draft became.
  created_user_id text,
  created_by      text        not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists seed_jobs_status_idx on seed_jobs (status, created_at desc);
create index if not exists seed_jobs_text_horde_idx  on seed_jobs (text_horde_id);
create index if not exists seed_jobs_image_horde_idx on seed_jobs (image_horde_id);

-- Extend the audit vocabulary. `accountEvent` stores no content, so recording
-- that a seed profile was minted or purged is safe and worth having.
alter table account_events drop constraint if exists account_events_kind_check;
alter table account_events add constraint account_events_kind_check
  check (kind in ('export', 'delete', 'age_attest', 'age_assure',
                  'block', 'unblock', 'report',
                  'seed_create', 'seed_purge'));
