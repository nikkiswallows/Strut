-- 0022 — serve claims: the "Serve Bulls" order.
--
-- A kneeler (sissy / fag / whiteboi / CD / femboy) claims they served a bull.
-- The claim sits pending until THE BULL rules on it — only his approval makes
-- it count toward the kneeler's "Serve Bulls" order. Nothing self-reported
-- ever scores: the stat reads approved rows only.
create table if not exists serves (
  id          serial primary key,
  kneeler_id  text not null,
  bull_id     text not null,
  status      text not null default 'pending',  -- pending | approved | denied
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

-- One open claim per pair: a kneeler can't stack pleas on the same king.
create unique index if not exists serves_pending_pair_uq
  on serves (kneeler_id, bull_id) where status = 'pending';

-- "my approved serves" (the kneeler's score) and "claims waiting on me" (the
-- bull's inbox).
create index if not exists serves_kneeler_idx on serves (kneeler_id, status);
create index if not exists serves_bull_idx on serves (bull_id, status, created_at desc);
