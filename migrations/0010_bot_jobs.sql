-- Async AI-reply jobs (AI Horde / slow providers).
--
-- When a user messages a seeded profile, we kick off a bot reply. Fast
-- providers resolve inline; slow/queued ones (AI Horde, free uncensored RP
-- models) return a job id that we poll out-of-band, so the request never
-- blocks on a multi-minute queue. One row per pending bot reply.
create table if not exists bot_jobs (
  id              bigserial primary key,
  conversation_id bigint not null references conversations(id) on delete cascade,
  seed_user_id    text   not null,
  horde_id        text,
  status          text   not null default 'pending',  -- pending|done|error|cancelled
  result_body     text,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bot_jobs_conv_idx on bot_jobs (conversation_id, created_at desc);
create index if not exists bot_jobs_status_idx on bot_jobs (status) where status = 'pending';
