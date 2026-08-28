-- 0013 — seed-state singleton.
--
-- ensureSeed() used to replay all ~53 seed-profile upserts on every fresh
-- serverless isolate (each cold start), because the "did I already seed?"
-- flag lived only in module memory. Persisting the seed version in the
-- database makes the check a single indexed row read: a fresh instance reads
-- the version, sees it matches SEED_VERSION, and skips the write storm.
-- Bump SEED_VERSION in src/lib/server/seed.ts to push updated seed content;
-- the next request that sees a mismatch replays the idempotent upserts and
-- records the new version.
create table if not exists seed_state (
  id         boolean primary key default true check (id),
  version    int      not null,
  updated_at timestamptz not null default now()
);

insert into seed_state (id, version) values (true, 0)
  on conflict (id) do nothing;
