-- 0014 — discreet mode.
--
-- Profiles can opt into "discreet" photos: the profile renders with its photos
-- blurred in the deck, grids, and lists until the viewer taps to reveal. This
-- is the single highest-requested safety feature in this niche (closeted /
-- married users will not join a fetish dating app that shows their face in a
-- swipe deck by default) — and it's a retention feature, not just a toggle.
alter table profiles add column if not exists discreet boolean not null default false;

create index if not exists profiles_discreet_idx on profiles (discreet) where discreet;
