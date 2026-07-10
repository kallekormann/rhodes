-- Fix workspace_members SELECT RLS recursion (500 from PostgREST).
-- The old policy called is_workspace_member(), which queries workspace_members
-- and re-triggered the same policy → infinite recursion.

drop policy if exists "Members can view workspace members" on workspace_members;

create policy "Users can view workspace memberships"
  on workspace_members for select
  using (
    user_id = auth.uid()
    or workspace_id in (
      select wm.workspace_id
      from workspace_members wm
      where wm.user_id = auth.uid()
    )
  );
