-- Backfill a default private workspace for users created before signup bootstrap,
-- and expose an idempotent RPC the app can call when no memberships exist.

create or replace function public.bootstrap_user_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  uid uuid := auth.uid();
  user_email text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select wm.workspace_id
  into ws_id
  from workspace_members wm
  where wm.user_id = uid
  order by wm.created_at asc
  limit 1;

  if ws_id is not null then
    return ws_id;
  end if;

  select email into user_email from auth.users where id = uid;

  insert into public.profiles (id, display_name)
  values (uid, split_part(coalesce(user_email, 'user'), '@', 1))
  on conflict (id) do nothing;

  insert into public.workspaces (name, is_team_workspace)
  values ('Private', false)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, uid, 'owner');

  return ws_id;
end;
$$;

grant execute on function public.bootstrap_user_workspace() to authenticated;
