-- 0011 — scale indexes for discover / social hot paths.
--
-- The app currently loads candidates in C, then filters/orders in JS (see
-- listDiscoverForUser). These indexes make the discover query able to filter and
-- paginate *in the database* so it stays O(page) instead of O(all profiles):
--
--   * bounding-box prefilter uses (lat, lng)  →  btree, partial on lat NOT NULL
--   * identity / looking-for tabs use `&&`/`@>` on JSONB  →  GIN
--   * "recently active" ordering uses (last_active DESC, id DESC)  →  btree
--   * inbox/unread/feed lookups get their own indexes
--
-- All statements are additive `create index if not exists` so they are safe to
-- re-run and apply identically on Neon (Postgres) and the local PGlite fallback.

-- Geo candidates: a btree on (lat, lng) lets Postgres seek to a lat range and,
-- with a lng range, narrow to a small square before the exact haversine filter.
create index if not exists profiles_latlng_idx
  on profiles (lat, lng)
  where lat is not null;

-- "Recently active" ordering for the discover deck (the hot, core query).
create index if not exists profiles_last_active_id_idx
  on profiles (last_active desc, id desc);

-- Identity tab matching (e.g. `identities @> '["Sissy"]'`).
create index if not exists profiles_identities_gin
  on profiles using gin (identities jsonb_path_ops);

-- Looking-for overlap matching.
create index if not exists profiles_looking_for_gin
  on profiles using gin (looking_for_list jsonb_path_ops);

-- Inbox: conversations are stored as an unordered (user_a, user_b) pair, so a
-- lookup by either side needs an index on both columns.
create index if not exists conversations_user_a_idx on conversations (user_a, user_b);
create index if not exists conversations_user_b_idx on conversations (user_b, user_a);

-- Feed: posts by author, then global recency (used by the Room / feed).
create index if not exists posts_user_created_idx on posts (user_id, created_at desc);
create index if not exists posts_global_created_idx on posts (created_at desc);

-- Unread badge: read_at IS NULL partial index keeps this a tiny lookup.
create index if not exists messages_unread_idx
  on messages (conversation_id, created_at desc)
  where read_at is null;

-- Likes tab: who liked/did I like, most recent first.
create index if not exists likes_to_created_idx on likes (to_user_id, created_at desc);
create index if not exists likes_from_created_idx on likes (from_user_id, created_at desc);
