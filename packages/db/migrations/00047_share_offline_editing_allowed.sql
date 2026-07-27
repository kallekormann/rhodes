-- Per-share offline editing (M1b.2 pivot): default allowed for edit shares;
-- document owner controls opt-out per grantee. Replaces documents.offline_available.

alter table public.document_shares
  add column if not exists offline_editing_allowed boolean not null default true;

comment on column public.document_shares.offline_editing_allowed is
  'When true with permission=edit, grantee may cache and edit offline. Owner may opt out per share.';

alter table public.document_shares
  drop constraint if exists document_shares_offline_editing_check;

alter table public.document_shares
  add constraint document_shares_offline_editing_check check (
    permission = 'edit' or offline_editing_allowed = false
  );

-- Read shares never allow offline editing.
create or replace function public.normalize_document_share_offline_editing()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.permission = 'read' then
    new.offline_editing_allowed := false;
  elsif tg_op = 'INSERT' and new.permission = 'edit' then
    new.offline_editing_allowed := coalesce(new.offline_editing_allowed, true);
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_document_share_offline_editing on public.document_shares;

create trigger normalize_document_share_offline_editing
  before insert or update on public.document_shares
  for each row
  execute function public.normalize_document_share_offline_editing();

-- Only the document owner may toggle offline_editing_allowed after insert.
create or replace function public.guard_document_share_offline_editing()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  doc_owner uuid;
begin
  if tg_op = 'UPDATE'
     and new.offline_editing_allowed is distinct from old.offline_editing_allowed then
    select created_by into doc_owner
    from public.documents
    where id = new.document_id;

    if doc_owner is distinct from auth.uid() then
      raise exception using
        errcode = '42501',
        message = 'only document owner can change offline_editing_allowed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_document_share_offline_editing on public.document_shares;

create trigger guard_document_share_offline_editing
  before update on public.document_shares
  for each row
  execute function public.guard_document_share_offline_editing();

drop policy if exists "Workspace members can update document shares" on public.document_shares;

create policy "Workspace members can update document shares"
  on public.document_shares for update
  using (
    public.is_workspace_member(public.document_workspace_id(document_id))
  )
  with check (
    public.is_workspace_member(public.document_workspace_id(document_id))
  );

create or replace function public.has_offline_document_share(doc_id uuid)
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
      and ds.offline_editing_allowed = true
      and (
        ds.grantee_user_id = auth.uid()
        or (
          ds.grantee_type = 'workspace'
          and public.is_workspace_member(ds.grantee_workspace_id)
        )
      )
  );
$$;

create or replace function public.can_offline_edit_document(doc_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.documents d
    where d.id = doc_id
      and d.created_by = auth.uid()
  )
  or public.has_offline_document_share(doc_id);
$$;

grant execute on function public.has_offline_document_share(uuid) to authenticated;
grant execute on function public.can_offline_edit_document(uuid) to authenticated;

-- Retire per-document offline_available (superseded by share-level + owner default).
drop trigger if exists guard_documents_offline_available on public.documents;
drop function if exists public.guard_documents_offline_available();
alter table public.documents drop column if exists offline_available;
