-- List workspace members with profile names (security definer, no PostgREST embed needed).

create or replace function public.list_workspace_members(ws_id uuid)
returns table (
  user_id uuid,
  display_name text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_workspace_member(ws_id) then
    raise exception 'Forbidden';
  end if;

  return query
  select
    wm.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Teammate') as display_name,
    wm.role,
    wm.created_at
  from workspace_members wm
  left join profiles p on p.id = wm.user_id
  where wm.workspace_id = ws_id
  order by wm.created_at asc;
end;
$$;

grant execute on function public.list_workspace_members(uuid) to authenticated;
