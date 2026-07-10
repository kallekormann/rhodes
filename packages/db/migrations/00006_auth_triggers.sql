create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, 'user'), '@', 1))
  on conflict (id) do nothing;

  insert into public.workspaces (name, is_team_workspace)
  values ('Private', false)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant execute on function public.handle_new_user() to service_role;

-- Ensure RLS applies even for table owners (required for SQL tests and defense in depth)
alter table documents force row level security;
alter table library_sources force row level security;
alter table library_source_chunks force row level security;
alter table document_versions force row level security;
alter table metadata_schemas force row level security;
alter table templates force row level security;
alter table views force row level security;
alter table workspaces force row level security;
alter table workspace_members force row level security;
alter table profiles force row level security;
alter table workspace_invites force row level security;
alter table subscriptions force row level security;
