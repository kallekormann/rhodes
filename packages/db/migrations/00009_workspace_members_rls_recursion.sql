-- Fix remaining workspace_members RLS recursion.
-- 00007 still subqueried workspace_members inside a workspace_members policy.
-- Any self-referential policy must use security definer helpers instead.

create or replace function public.user_workspace_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id
  from public.workspace_members
  where user_id = auth.uid();
$$;

create or replace function public.is_workspace_admin(ws_id uuid)
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
      and role in ('owner', 'admin')
  );
$$;

grant execute on function public.user_workspace_ids() to authenticated, anon, service_role;
grant execute on function public.is_workspace_admin(uuid) to authenticated, anon, service_role;

-- workspace_members
drop policy if exists "Users can view workspace memberships" on workspace_members;
drop policy if exists "Owners and admins can manage members" on workspace_members;

create policy "Users can view workspace memberships"
  on workspace_members for select
  using (
    user_id = auth.uid()
    or workspace_id in (select public.user_workspace_ids())
  );

create policy "Owners and admins can insert members"
  on workspace_members for insert
  with check (public.is_workspace_admin(workspace_id));

create policy "Owners and admins can update members"
  on workspace_members for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy "Owners and admins can delete members"
  on workspace_members for delete
  using (public.is_workspace_admin(workspace_id));

-- workspaces (avoid direct workspace_members subqueries in policies)
drop policy if exists "Owners and admins can update workspace" on workspaces;

create policy "Owners and admins can update workspace"
  on workspaces for update
  using (public.is_workspace_admin(id));

-- workspace_invites
drop policy if exists "Admins can manage invites" on workspace_invites;

create policy "Admins can manage invites"
  on workspace_invites for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
