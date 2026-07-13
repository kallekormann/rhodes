-- Revoke pending invites and remove team members (admin/owner only).

create or replace function public.revoke_workspace_invite(ws_id uuid, invite_id uuid)
returns void
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

  delete from workspace_invites
  where id = invite_id
    and workspace_id = ws_id
    and accepted_at is null;
end;
$$;

grant execute on function public.revoke_workspace_invite(uuid, uuid) to authenticated;

create or replace function public.remove_workspace_member(ws_id uuid, member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
  owner_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if member_user_id = auth.uid() then
    raise exception 'You cannot remove yourself from the team';
  end if;

  select role into caller_role
  from workspace_members
  where workspace_id = ws_id and user_id = auth.uid();

  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'Forbidden';
  end if;

  select role into target_role
  from workspace_members
  where workspace_id = ws_id and user_id = member_user_id;

  if target_role is null then
    raise exception 'Member not found';
  end if;

  if target_role = 'owner' then
    raise exception 'Cannot remove the team owner';
  end if;

  if caller_role = 'admin' and target_role = 'admin' then
    raise exception 'Admins cannot remove other admins';
  end if;

  if target_role = 'owner' then
    select count(*)::int into owner_count
    from workspace_members
    where workspace_id = ws_id and role = 'owner';

    if owner_count <= 1 then
      raise exception 'Cannot remove the last owner';
    end if;
  end if;

  delete from workspace_members
  where workspace_id = ws_id and user_id = member_user_id;
end;
$$;

grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
