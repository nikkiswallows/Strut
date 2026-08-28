-- 0016 — safety: blocks and reports.
--
-- Before this migration the app had no block, no report, no mute and no
-- moderation surface of any kind. For any dating app that is a gap; for one
-- serving a closeted and married audience — where an unwanted contact can be a
-- catastrophic, life-altering event — it is the difference between a product
-- and a liability.
--
-- Blocks are symmetrical by design: if either party blocks, neither can see the
-- other in the deck, in likes, or in chat. That is what makes "block" feel
-- safe to press, and it is what stops a blocked account from continuing to
-- watch the person who blocked them.

create table if not exists blocks (
  blocker_id   text not null,
  blocked_id   text not null,
  created_at   timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self_chk check (blocker_id <> blocked_id)
);

-- "who did I block" (settings screen) and "who blocked me" (exclusion).
create index if not exists blocks_blocker_idx on blocks (blocker_id, created_at desc);
create index if not exists blocks_blocked_idx on blocks (blocked_id);

create table if not exists reports (
  id            serial primary key,
  reporter_id   text not null,
  reported_id   text not null,
  reason        text not null,
  detail        text,
  -- Snapshot of the offending context so moderation still works after the
  -- reporter deletes their account or the message is edited.
  conversation_id int,
  message_id      int,
  status        text not null default 'open'
                check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  resolution    text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   text
);

create index if not exists reports_status_idx on reports (status, created_at desc);
create index if not exists reports_reported_idx on reports (reported_id, created_at desc);
create index if not exists reports_reporter_idx on reports (reporter_id, created_at desc);
