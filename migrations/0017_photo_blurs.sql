-- 0017 — discreet mode: real blur placeholders.
--
-- Discreet mode previously rendered the full-resolution photo and blurred it
-- with a CSS filter (`blur-2xl`). The real image was still downloaded by the
-- browser and available via right-click → Open Image, view-source, or devtools.
-- For a closeted or married member that is a promise the app did not keep.
--
-- The fix: store a tiny (24px-wide) JPEG data URI generated in the browser at
-- upload time, aligned index-wise with `photos`. Discreet mode renders that
-- placeholder and the real URL never enters the DOM until the viewer taps to
-- reveal. Profiles with no placeholder fall back to a generic silhouette —
-- never to the real photo.
--
-- These are ~1-2 KB each and travel with the profile row, so no extra query.

alter table profiles add column if not exists photo_blurs jsonb not null default '[]';

-- Keep the column a JSON array of short strings even if a caller misbehaves.
alter table profiles drop constraint if exists profiles_photo_blurs_arr_chk;
alter table profiles add constraint profiles_photo_blurs_arr_chk
  check (jsonb_typeof(photo_blurs) = 'array');
