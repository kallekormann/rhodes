-- Create personal or team scopes with owner membership (bypasses RLS chicken-and-egg).

create or replace function public.create_user_workspace(
  ws_name text,
  is_team boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  uid uuid := auth.uid();
  personal_count int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if ws_name is null or trim(ws_name) = '' then
    raise exception 'Scope name is required';
  end if;

  if not is_team then
    select count(*)::int
    into personal_count
    from workspace_members wm
    join workspaces w on w.id = wm.workspace_id
    where wm.user_id = uid
      and wm.role = 'owner'
      and w.is_team_workspace = false;

    if personal_count >= 10 then
      raise exception 'Personal scope limit reached';
    end if;
  end if;

  insert into public.workspaces (name, is_team_workspace)
  values (trim(ws_name), is_team)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, uid, 'owner');

  return ws_id;
end;
$$;

grant execute on function public.create_user_workspace(text, boolean) to authenticated;
