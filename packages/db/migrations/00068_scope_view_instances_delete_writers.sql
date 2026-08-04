-- Align view-instance delete with write access (members can remove boards they can create).
-- Previous policy allowed only owner/admin, so DELETE succeeded in the API but RLS removed 0 rows.

drop policy if exists "Owners and admins can delete scope view instances"
  on public.scope_view_instances;

create policy "Writers can delete scope view instances"
  on public.scope_view_instances for delete
  using (public.can_write_workspace(workspace_id));
