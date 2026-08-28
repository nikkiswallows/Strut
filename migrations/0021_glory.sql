-- 0021 — glory / the Orders of the Set.
--
-- The gamification layer. Almost every achievement is computed live from the
-- tables that already exist (likes, swipes, conversations, messages, posts,
-- profiles), so there is no denormalized counter to drift. The ONLY new state
-- is a chastity-lock session log: sissies / whitebois / cucks lock up for a
-- chosen duration and earn "Locked" credit for the time they actually serve.
-- A session is open (released_at null) until the holder releases it or it
-- reaches its pledged duration (which counts as completed).
create table if not exists lock_sessions (
  id            serial primary key,
  user_id       text not null,
  started_at    timestamptz not null default now(),
  released_at   timestamptz,
  -- pledged service length in hours at lock-time; null = indefinite.
  pledge_hours  int,
  -- set true when the session ran its full pledge (or was released after it).
  completed     boolean not null default false,
  note          text
);

-- "the user's current open lock" (at most one open session per user is
-- enforced in code).
create index if not exists lock_sessions_open_idx
  on lock_sessions (user_id) where released_at is null;

-- "all of a user's sessions, newest first" (history + total served time).
create index if not exists lock_sessions_user_idx
  on lock_sessions (user_id, started_at desc);
