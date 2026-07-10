-- CI-only bootstrap when auth.users is missing.
-- Supabase Docker already provisions auth; skip there.

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'auth'
      and table_name = 'users'
  ) then
    execute 'create schema auth';
    execute $sql$
      create table auth.users (
        id uuid primary key,
        email text,
        locale text default 'en',
        theme text default 'system'
      )
    $sql$;
  end if;
end $$;
