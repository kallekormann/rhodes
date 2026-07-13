-- Invite preview (by secret token) and admin pending-invite listing.

create or replace function public.get_workspace_invite_preview(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row workspace_invites%rowtype;
  ws_name text;
begin
  if invite_token is null or trim(invite_token) = '' then
    return jsonb_build_object('valid', false, 'reason', 'missing_token');
  end if;

  select *
  into invite_row
  from workspace_invites
  where token = trim(invite_token)
  limit 1;

  if invite_row.id is null then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if invite_row.accepted_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'already_accepted');
  end if;

  if invite_row.expires_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  select name into ws_name from workspaces where id = invite_row.workspace_id;

  return jsonb_build_object(
    'valid', true,
    'workspace_name', coalesce(ws_name, 'Team scope'),
    'email', invite_row.email,
    'role', invite_row.role,
    'expires_at', invite_row.expires_at
  );
end;
$$;

grant execute on function public.get_workspace_invite_preview(text) to authenticated;

create or replace function public.list_workspace_pending_invites(ws_id uuid)
returns table (
  id uuid,
  email text,
  role text,
  expires_at timestamptz,
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

  if not public.is_workspace_admin(ws_id) then
    raise exception 'Forbidden';
  end if;

  return query
  select
    wi.id,
    wi.email,
    wi.role,
    wi.expires_at,
    wi.created_at
  from workspace_invites wi
  where wi.workspace_id = ws_id
    and wi.accepted_at is null
    and wi.expires_at > now()
  order by wi.created_at desc;
end;
$$;

grant execute on function public.list_workspace_pending_invites(uuid) to authenticated;
