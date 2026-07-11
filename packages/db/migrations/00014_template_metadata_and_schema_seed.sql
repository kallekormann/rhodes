-- Template metadata JSONB + default workspace metadata schemas

alter table templates
  add column if not exists metadata jsonb not null default '{}';

create or replace function public.seed_default_metadata_schemas(ws_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options)
  values
    (ws_id, 'status', 'Status', 'select', '["draft","in_progress","done"]'::jsonb),
    (ws_id, 'summary', 'Summary', 'text', null),
    (ws_id, 'due_date', 'Due', 'date', null)
  on conflict (workspace_id, field_key) do nothing;
end;
$$;

grant execute on function public.seed_default_metadata_schemas(uuid) to authenticated;

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

  perform public.seed_default_metadata_schemas(ws_id);

  return ws_id;
end;
$$;

-- Backfill default schemas for workspaces that have none yet
do $$
declare
  ws record;
begin
  for ws in
    select w.id
    from workspaces w
    where not exists (
      select 1 from metadata_schemas ms where ms.workspace_id = w.id
    )
  loop
    perform public.seed_default_metadata_schemas(ws.id);
  end loop;
end;
$$;
