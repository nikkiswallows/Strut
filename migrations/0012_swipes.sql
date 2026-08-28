-- 0012 — swipe deck decisions (likes + passes as a single "decided on" log).
--
-- The Tinder-style deck needs to know which profiles a user has already decided
-- on, so it can advance past them and mirror those decisions into the existing
-- `likes`/match logic. One row per (user, target) with a direction; `likes`
-- stays the source of truth for matches, and a pass clears any prior like.
create table if not exists swipes (
  user_id    text not null,
  target_id  text not null,
  direction  text not null check (direction in ('like', 'pass')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_id)
);

-- "what has this user decided on, most recent first" (deck exclusion).
create index if not exists swipes_user_created_idx
  on swipes (user_id, created_at desc);

-- "who decided on this target" (used to compute incoming deck interest).
create index if not exists swipes_target_idx
  on swipes (target_id, direction);
