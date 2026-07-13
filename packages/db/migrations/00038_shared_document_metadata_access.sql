-- Allow shared-document recipients to read and manage origin workspace property schemas.

create or replace function public.can_read_workspace_metadata(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_workspace_member(ws_id)
    or exists (
      select 1
      from public.documents d
      where d.workspace_id = ws_id
        and public.is_document_shared_with_user(d.id)
    );
$$;

create or replace function public.can_manage_workspace_metadata(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.can_write_workspace(ws_id)
    or exists (
      select 1
      from public.documents d
      where d.workspace_id = ws_id
        and public.has_document_edit_share(d.id)
    );
$$;

grant execute on function public.can_read_workspace_metadata(uuid) to authenticated;
grant execute on function public.can_manage_workspace_metadata(uuid) to authenticated;

drop policy if exists "Members can manage metadata schemas" on metadata_schemas;

create policy "Readers can select metadata schemas"
  on metadata_schemas for select
  using (public.can_read_workspace_metadata(workspace_id));

create policy "Editors can insert metadata schemas"
  on metadata_schemas for insert
  with check (public.can_manage_workspace_metadata(workspace_id));

create policy "Editors can update metadata schemas"
  on metadata_schemas for update
  using (public.can_manage_workspace_metadata(workspace_id));

create policy "Editors can delete metadata schemas"
  on metadata_schemas for delete
  using (public.can_manage_workspace_metadata(workspace_id));

drop policy if exists "Members can manage metadata schema groups" on metadata_schema_groups;

create policy "Readers can select metadata schema groups"
  on metadata_schema_groups for select
  using (public.can_read_workspace_metadata(workspace_id));

create policy "Editors can insert metadata schema groups"
  on metadata_schema_groups for insert
  with check (public.can_manage_workspace_metadata(workspace_id));

create policy "Editors can update metadata schema groups"
  on metadata_schema_groups for update
  using (public.can_manage_workspace_metadata(workspace_id));

create policy "Editors can delete metadata schema groups"
  on metadata_schema_groups for delete
  using (public.can_manage_workspace_metadata(workspace_id));
