-- Delete a scope the user administers. Initial personal scope cannot be removed.

create or replace function public.delete_user_workspace(ws_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ws public.workspaces%rowtype;
  oldest_personal_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into ws
  from public.workspaces
  where id = ws_id;

  if ws.id is null then
    raise exception 'Scope not found';
  end if;

  if not public.is_workspace_admin(ws_id) then
    raise exception 'Only scope admins can delete this scope';
  end if;

  if not ws.is_team_workspace then
    select w.id
    into oldest_personal_id
    from public.workspaces w
    join public.workspace_members wm on wm.workspace_id = w.id
    where wm.user_id = uid
      and wm.role = 'owner'
      and w.is_team_workspace = false
    order by w.created_at asc
    limit 1;

    if oldest_personal_id = ws_id then
      raise exception 'Your initial personal scope cannot be deleted';
    end if;
  end if;

  delete from public.workspaces where id = ws_id;
end;
$$;

grant execute on function public.delete_user_workspace(uuid) to authenticated;
