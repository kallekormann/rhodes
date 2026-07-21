-- Close known RLS gaps and fail migrate if any public table lacks enabled RLS.

alter table metadata_schema_groups force row level security;

alter table webhook_events enable row level security;
alter table webhook_events force row level security;
-- No policies for authenticated/anon — service_role only

do $$
declare
  tbl text;
begin
  for tbl in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname not in ('schema_migrations')
      and not c.relrowsecurity
  loop
    raise exception 'RLS not enabled on public.%', tbl;
  end loop;

  for tbl in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname not in ('schema_migrations')
      and c.relrowsecurity
      and not c.relforcerowsecurity
  loop
    raise warning 'RLS enabled but not forced on public.%', tbl;
  end loop;
end $$;
