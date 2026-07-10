-- Break documents <-> document_shares RLS recursion.
-- documents SELECT referenced document_shares; document_shares referenced documents.
-- PostgREST INSERT ... RETURNING re-ran SELECT and triggered infinite recursion.

create or replace function public.document_workspace_id(doc_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id
  from public.documents
  where id = doc_id;
$$;

create or replace function public.is_document_shared_with_user(doc_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.document_shares ds
    where ds.document_id = doc_id
      and (
        ds.grantee_user_id = auth.uid()
        or (
          ds.grantee_type = 'workspace'
          and public.is_workspace_member(ds.grantee_workspace_id)
        )
      )
  );
$$;

grant execute on function public.document_workspace_id(uuid) to authenticated, anon, service_role;
grant execute on function public.is_document_shared_with_user(uuid) to authenticated, anon, service_role;

drop policy if exists "Members can select documents" on documents;

create policy "Members can select documents"
  on documents for select
  using (
    public.is_workspace_member(workspace_id)
    or public.is_document_shared_with_user(id)
  );

drop policy if exists "Users can view relevant document shares" on document_shares;
drop policy if exists "Workspace members can manage document shares" on document_shares;
drop policy if exists "Workspace members can delete document shares" on document_shares;

create policy "Users can view relevant document shares"
  on document_shares for select
  using (
    grantee_user_id = auth.uid()
    or (
      grantee_type = 'workspace'
      and public.is_workspace_member(grantee_workspace_id)
    )
    or public.is_workspace_member(public.document_workspace_id(document_id))
  );

create policy "Workspace members can manage document shares"
  on document_shares for insert
  with check (
    public.is_workspace_member(public.document_workspace_id(document_id))
  );

create policy "Workspace members can delete document shares"
  on document_shares for delete
  using (
    public.is_workspace_member(public.document_workspace_id(document_id))
  );
