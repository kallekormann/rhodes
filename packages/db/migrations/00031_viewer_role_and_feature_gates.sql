-- Viewer role (read-only) + write access helpers + member role updates.

alter table workspace_members
  drop constraint if exists workspace_members_role_check;

alter table workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'member', 'viewer'));

alter table workspace_invites
  drop constraint if exists workspace_invites_role_check;

alter table workspace_invites
  add constraint workspace_invites_role_check
  check (role in ('admin', 'member', 'viewer'));

create or replace function public.can_write_workspace(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'member')
  );
$$;

grant execute on function public.can_write_workspace(uuid) to authenticated;

drop policy if exists "Members can insert documents" on documents;
drop policy if exists "Members can update documents" on documents;
drop policy if exists "Members can delete documents" on documents;

create policy "Writers can insert documents"
  on documents for insert
  with check (public.can_write_workspace(workspace_id));

create policy "Writers can update documents"
  on documents for update
  using (public.can_write_workspace(workspace_id));

create policy "Writers can delete documents"
  on documents for delete
  using (public.can_write_workspace(workspace_id));

drop policy if exists "Members can insert library sources" on library_sources;
drop policy if exists "Members can update library sources" on library_sources;
drop policy if exists "Members can delete library sources" on library_sources;

create policy "Writers can insert library sources"
  on library_sources for insert
  with check (public.can_write_workspace(workspace_id));

create policy "Writers can update library sources"
  on library_sources for update
  using (public.can_write_workspace(workspace_id));

create policy "Writers can delete library sources"
  on library_sources for delete
  using (public.can_write_workspace(workspace_id));

drop policy if exists "Members can insert library chunks" on library_source_chunks;
drop policy if exists "Members can update library chunks" on library_source_chunks;
drop policy if exists "Members can delete library chunks" on library_source_chunks;

create policy "Writers can insert library chunks"
  on library_source_chunks for insert
  with check (public.can_write_workspace(workspace_id));

create policy "Writers can update library chunks"
  on library_source_chunks for update
  using (public.can_write_workspace(workspace_id));

create policy "Writers can delete library chunks"
  on library_source_chunks for delete
  using (public.can_write_workspace(workspace_id));

create or replace function public.update_workspace_member_role(
  ws_id uuid,
  member_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if new_role is null or new_role not in ('admin', 'member', 'viewer') then
    raise exception 'Invalid role';
  end if;

  if member_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
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
    raise exception 'Cannot change the team owner role';
  end if;

  if caller_role = 'admin' then
    if target_role = 'admin' then
      raise exception 'Admins cannot change other admins';
    end if;
    if new_role = 'admin' then
      raise exception 'Only the team owner can assign admins';
    end if;
  end if;

  update workspace_members
  set role = new_role
  where workspace_id = ws_id and user_id = member_user_id;
end;
$$;

grant execute on function public.update_workspace_member_role(uuid, uuid, text) to authenticated;
