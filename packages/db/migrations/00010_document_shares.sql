-- Document sharing grants (cross-user / cross-workspace read access).

create table document_shares (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade not null,
  shared_by uuid references auth.users(id) on delete set null,
  grantee_type text not null check (grantee_type in ('user', 'workspace')),
  grantee_user_id uuid references auth.users(id) on delete cascade,
  grantee_workspace_id uuid references workspaces(id) on delete cascade,
  label text not null,
  created_at timestamptz default now() not null,
  constraint document_shares_grantee_check check (
    (grantee_type = 'user' and grantee_user_id is not null and grantee_workspace_id is null)
    or (grantee_type = 'workspace' and grantee_workspace_id is not null and grantee_user_id is null)
  )
);

create unique index document_shares_user_unique
  on document_shares (document_id, grantee_user_id)
  where grantee_type = 'user';

create unique index document_shares_workspace_unique
  on document_shares (document_id, grantee_workspace_id)
  where grantee_type = 'workspace';

create index document_shares_document_idx on document_shares (document_id);
create index document_shares_grantee_user_idx on document_shares (grantee_user_id);
create index document_shares_grantee_workspace_idx on document_shares (grantee_workspace_id);

alter table document_shares enable row level security;
alter table document_shares force row level security;

create policy "Users can view relevant document shares"
  on document_shares for select
  using (
    grantee_user_id = auth.uid()
    or (grantee_type = 'workspace' and public.is_workspace_member(grantee_workspace_id))
    or exists (
      select 1
      from documents d
      where d.id = document_id
        and public.is_workspace_member(d.workspace_id)
    )
  );

create policy "Workspace members can manage document shares"
  on document_shares for insert
  with check (
    exists (
      select 1
      from documents d
      where d.id = document_id
        and public.is_workspace_member(d.workspace_id)
    )
  );

create policy "Workspace members can delete document shares"
  on document_shares for delete
  using (
    exists (
      select 1
      from documents d
      where d.id = document_id
        and public.is_workspace_member(d.workspace_id)
    )
  );

-- Allow reading documents shared with the current user / their workspaces.
drop policy if exists "Members can select documents" on documents;

create policy "Members can select documents"
  on documents for select
  using (
    public.is_workspace_member(workspace_id)
    or exists (
      select 1
      from document_shares ds
      where ds.document_id = documents.id
        and (
          ds.grantee_user_id = auth.uid()
          or (
            ds.grantee_type = 'workspace'
            and public.is_workspace_member(ds.grantee_workspace_id)
          )
        )
    )
  );

-- Co-member profile lookup for share picker.
create policy "Workspace members can view co-member profiles"
  on profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from workspace_members wm_self
      join workspace_members wm_other on wm_self.workspace_id = wm_other.workspace_id
      where wm_self.user_id = auth.uid()
        and wm_other.user_id = profiles.id
    )
  );
