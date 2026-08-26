alter table profiles add column if not exists identities jsonb not null default '[]';
alter table profiles add column if not exists pronoun_list jsonb not null default '[]';
alter table profiles add column if not exists hide_age boolean not null default false;
alter table profiles add column if not exists lat double precision;
alter table profiles add column if not exists lng double precision;

create table if not exists catalog_tags (
  kind        text not null,
  label       text not null,
  created_at  timestamptz not null default now(),
  primary key (kind, label)
);
