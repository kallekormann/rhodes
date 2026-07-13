-- Never downgrade owner/admin when accepting invites.

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
    set role = case
      when workspace_members.role = 'owner' then workspace_members.role
      when workspace_members.role = 'admin' and excluded.role = 'member' then workspace_members.role
      else excluded.role
    end;

  update workspace_invites
  set accepted_at = now()
  where id = invite_row.id;

  return invite_row.workspace_id;
end;
$$;

create or replace function public.accept_pending_workspace_invites()
returns table (
  workspace_id uuid,
  workspace_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  invite_row workspace_invites%rowtype;
  ws_name text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select email into user_email from auth.users where id = uid;

  if user_email is null or trim(user_email) = '' then
    return;
  end if;

  for invite_row in
    select *
    from workspace_invites
    where lower(trim(email)) = lower(trim(user_email))
      and accepted_at is null
      and expires_at > now()
    order by created_at asc
  loop
    insert into workspace_members (workspace_id, user_id, role)
    values (invite_row.workspace_id, uid, invite_row.role)
    on conflict (workspace_id, user_id) do update
      set role = case
        when workspace_members.role = 'owner' then workspace_members.role
        when workspace_members.role = 'admin' and excluded.role = 'member' then workspace_members.role
        else excluded.role
      end;

    update workspace_invites
    set accepted_at = now()
    where id = invite_row.id;

    select name into ws_name from workspaces where id = invite_row.workspace_id;

    workspace_id := invite_row.workspace_id;
    workspace_name := coalesce(ws_name, 'Team scope');
    return next;
  end loop;
end;
$$;
