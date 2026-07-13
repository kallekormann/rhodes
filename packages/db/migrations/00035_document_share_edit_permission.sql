-- Share edit permission + document write ACL for share grantees.

alter table document_shares
  add column if not exists permission text not null default 'edit'
  constraint document_shares_permission_check check (permission in ('read', 'edit'));

create or replace function public.has_document_edit_share(doc_id uuid)
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
      and ds.permission = 'edit'
      and (
        ds.grantee_user_id = auth.uid()
        or (
          ds.grantee_type = 'workspace'
          and public.is_workspace_member(ds.grantee_workspace_id)
        )
      )
  );
$$;

create or replace function public.can_write_document(doc_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.can_write_workspace(public.document_workspace_id(doc_id))
    or public.has_document_edit_share(doc_id);
$$;

grant execute on function public.has_document_edit_share(uuid) to authenticated;
grant execute on function public.can_write_document(uuid) to authenticated;

drop policy if exists "Writers can update documents" on documents;

create policy "Writers can update documents"
  on documents for update
  using (public.can_write_document(id));

-- Share recipients with edit access may insert version snapshots.
drop policy if exists "Members can insert document versions" on document_versions;
drop policy if exists "Members can select document versions" on document_versions;

create policy "Readers can select document versions"
  on document_versions for select
  using (
    public.is_workspace_member(workspace_id)
    or public.is_document_shared_with_user(document_id)
  );

create policy "Writers can insert document versions"
  on document_versions for insert
  with check (public.can_write_document(document_id));
