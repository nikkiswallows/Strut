alter table profiles add column if not exists ethnicity text;

create index if not exists profiles_ethnicity_idx on profiles (ethnicity);
