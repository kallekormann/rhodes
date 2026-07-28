-- Workspace-scoped Supabase Storage policies (library-files, document-images).
-- Path convention: {workspace_id}/… — first folder must be a workspace the user belongs to.

drop policy if exists "Workspace members can upload library files" on storage.objects;
drop policy if exists "Workspace members can read library files" on storage.objects;
drop policy if exists "Workspace members can upload document images" on storage.objects;
drop policy if exists "Workspace members can read document images" on storage.objects;

create or replace function public.storage_object_workspace_id(object_name text)
returns uuid
language sql
immutable
as $$
  select (storage.foldername(object_name))[1]::uuid;
$$;

revoke all on function public.storage_object_workspace_id(text) from public;
grant execute on function public.storage_object_workspace_id(text) to authenticated, service_role;

create policy "Library files: workspace members insert"
  on storage.objects for insert
  with check (
    bucket_id = 'library-files'
    and auth.uid() is not null
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );

create policy "Library files: workspace members select"
  on storage.objects for select
  using (
    bucket_id = 'library-files'
    and auth.uid() is not null
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );

create policy "Library files: workspace members update"
  on storage.objects for update
  using (
    bucket_id = 'library-files'
    and auth.uid() is not null
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );

create policy "Library files: workspace members delete"
  on storage.objects for delete
  using (
    bucket_id = 'library-files'
    and auth.uid() is not null
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );

create policy "Document images: workspace members insert"
  on storage.objects for insert
  with check (
    bucket_id = 'document-images'
    and auth.uid() is not null
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );

create policy "Document images: workspace members select"
  on storage.objects for select
  using (
    bucket_id = 'document-images'
    and auth.uid() is not null
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );

create policy "Document images: workspace members update"
  on storage.objects for update
  using (
    bucket_id = 'document-images'
    and auth.uid() is not null
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );

create policy "Document images: workspace members delete"
  on storage.objects for delete
  using (
    bucket_id = 'document-images'
    and auth.uid() is not null
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );
