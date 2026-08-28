-- 0018 — account lifecycle events (deletion / export audit trail).
--
-- GDPR and CCPA both require deletion and portability, and both reward being
-- able to *prove* you honoured them. This table records the who/when of
-- destructive and data-export operations. It deliberately stores no message
-- content and no photos — an audit row must never itself become the leak.

create table if not exists account_events (
  id          serial primary key,
  user_id     text not null,
  kind        text not null
              check (kind in ('export', 'delete', 'age_attest', 'age_assure',
                              'block', 'unblock', 'report')),
  detail      jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists account_events_user_idx on account_events (user_id, created_at desc);
create index if not exists account_events_kind_idx on account_events (kind, created_at desc);
