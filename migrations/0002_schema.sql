create table if not exists profiles (
  id            serial primary key,
  user_id       text not null unique,
  handle        text not null unique,
  display_name  text not null,
  age           int,
  identity      text,
  pronouns      text,
  bio           text not null default '',
  location      text,
  looking_for   text,
  photos        jsonb not null default '[]',
  interests     jsonb not null default '[]',
  height_cm     int,
  is_seed       boolean not null default false,
  auto_match    boolean not null default false,
  last_active   timestamptz not null default now(),
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists profiles_handle_idx on profiles (handle);
create index if not exists profiles_last_active_idx on profiles (last_active desc);

create table if not exists posts (
  id          serial primary key,
  user_id     text not null,
  body        text not null,
  photo_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists posts_user_id_idx on posts (user_id);
create index if not exists posts_created_at_idx on posts (created_at desc);

create table if not exists likes (
  from_user_id text not null,
  to_user_id   text not null,
  created_at   timestamptz not null default now(),
  primary key (from_user_id, to_user_id)
);

create index if not exists likes_to_user_idx on likes (to_user_id);

create table if not exists follows (
  follower_id  text not null,
  following_id text not null,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id)
);

create table if not exists post_likes (
  post_id     int not null,
  user_id     text not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists conversations (
  id               serial primary key,
  user_a           text not null,
  user_b           text not null,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create unique index if not exists conversations_pair_idx
  on conversations ((least(user_a, user_b)), (greatest(user_a, user_b)));

create table if not exists messages (
  id               serial primary key,
  conversation_id  int not null references conversations(id) on delete cascade,
  sender_id        text not null,
  body             text not null,
  created_at       timestamptz not null default now(),
  read_at          timestamptz
);

create index if not exists messages_conversation_idx
  on messages (conversation_id, created_at);
