-- Accept a workspace invite and add the authenticated user as a member.

create or replace function public.accept_workspace_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row workspace_invites%rowtype;
  uid uuid := auth.uid();
  user_email text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if invite_token is null or trim(invite_token) = '' then
    raise exception 'Invite token is required';
  end if;

  select email into user_email from auth.users where id = uid;

  select *
  into invite_row
  from workspace_invites
  where token = trim(invite_token)
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if invite_row.id is null then
    raise exception 'Invite not found or expired';
  end if;

  if lower(trim(invite_row.email)) <> lower(trim(coalesce(user_email, ''))) then
    raise exception 'This invite was sent to a different email address';
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (invite_row.workspace_id, uid, invite_row.role)
  on conflict (workspace_id, user_id) do update
    set role = excluded.role;

  update workspace_invites
  set accepted_at = now()
  where id = invite_row.id;

  return invite_row.workspace_id;
end;
$$;

grant execute on function public.accept_workspace_invite(text) to authenticated;
