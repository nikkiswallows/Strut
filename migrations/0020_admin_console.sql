-- 0020 — admin console: suspension, and the audit vocabulary that goes with it.
--
-- The seed generator (0019) could create and delete. An operator also needs the
-- middle option: take a profile out of circulation WITHOUT destroying it, so a
-- questionable account can be parked while it is reviewed and restored if the
-- review clears it. Deletion is irreversible and therefore the wrong default
-- for moderation.
--
-- `suspended` is enforced in SQL on every read path that builds a deck, a grid,
-- a search result or the public landing strip — not filtered in JS afterwards,
-- which would leave a suspended profile occupying a page slot and leaking
-- through any code path that forgot the filter.

alter table profiles add column if not exists suspended    boolean not null default false;
alter table profiles add column if not exists suspended_at timestamptz;
alter table profiles add column if not exists suspended_by text;

-- Partial index: the overwhelming majority of rows are not suspended, so only
-- index the ones that are. Reads use `not suspended`, which the planner
-- satisfies from the table; this index serves the admin console's own listing.
create index if not exists profiles_suspended_idx on profiles (suspended) where suspended;

-- Audit vocabulary for the new operator actions.
alter table account_events drop constraint if exists account_events_kind_check;
alter table account_events add constraint account_events_kind_check
  check (kind in ('export', 'delete', 'age_attest', 'age_assure',
                  'block', 'unblock', 'report',
                  'seed_create', 'seed_purge',
                  'seed_edit', 'suspend', 'unsuspend', 'admin_bootstrap'));

-- The admin console lets a draft be hand-edited before approval. Record the
-- edited copy separately from what the model produced, so provenance stays
-- honest: `draft` is the machine output, `draft_edited` is what a human
-- actually approved.
alter table seed_jobs add column if not exists draft_edited jsonb;
