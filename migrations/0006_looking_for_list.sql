alter table profiles add column if not exists looking_for_list jsonb not null default '[]';

update profiles
set looking_for_list = jsonb_build_array(looking_for)
where (looking_for_list = '[]'::jsonb or looking_for_list is null)
  and looking_for is not null
  and btrim(looking_for) <> '';
