alter table profiles add column if not exists role text;

create index if not exists profiles_role_idx on profiles (role);
