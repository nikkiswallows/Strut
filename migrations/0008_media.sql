create table if not exists media (
  id          text primary key,
  user_id     text not null,
  url         text not null,
  kind        text not null default 'photo',
  bytes       int,
  created_at  timestamptz not null default now()
);

create index if not exists media_user_idx on media (user_id, created_at desc);
