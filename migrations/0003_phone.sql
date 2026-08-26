-- Phone sign-in: one-time codes and the mapping from E.164 number → Better Auth user.
create table if not exists phone_otps (
  id           serial primary key,
  phone_e164   text not null,
  code_hash    text not null,
  attempts     int not null default 0,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create index if not exists phone_otps_phone_idx
  on phone_otps (phone_e164, created_at desc);

create table if not exists phone_identities (
  phone_e164  text primary key,
  user_id     text not null unique,
  created_at  timestamptz not null default now()
);

create index if not exists phone_identities_user_idx
  on phone_identities (user_id);
