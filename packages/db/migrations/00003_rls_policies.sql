create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated, anon, service_role;

-- workspaces
alter table workspaces enable row level security;

create policy "Members can view workspace"
  on workspaces for select
  using (is_workspace_member(id));

create policy "Authenticated users can create workspace"
  on workspaces for insert
  with check (auth.uid() is not null);

create policy "Owners and admins can update workspace"
  on workspaces for update
  using (
    exists (
      select 1 from workspace_members
      where workspace_id = id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- workspace_members
alter table workspace_members enable row level security;

create policy "Members can view workspace members"
  on workspace_members for select
  using (is_workspace_member(workspace_id));

create policy "Owners and admins can manage members"
  on workspace_members for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- documents
alter table documents enable row level security;

create policy "Members can select documents"
  on documents for select using (is_workspace_member(workspace_id));
create policy "Members can insert documents"
  on documents for insert with check (is_workspace_member(workspace_id));
create policy "Members can update documents"
  on documents for update using (is_workspace_member(workspace_id));
create policy "Members can delete documents"
  on documents for delete using (is_workspace_member(workspace_id));

-- library_sources
alter table library_sources enable row level security;

create policy "Members can select library sources"
  on library_sources for select using (is_workspace_member(workspace_id));
create policy "Members can insert library sources"
  on library_sources for insert with check (is_workspace_member(workspace_id));
create policy "Members can update library sources"
  on library_sources for update using (is_workspace_member(workspace_id));
create policy "Members can delete library sources"
  on library_sources for delete using (is_workspace_member(workspace_id));

-- library_source_chunks
alter table library_source_chunks enable row level security;

create policy "Members can select library chunks"
  on library_source_chunks for select using (is_workspace_member(workspace_id));
create policy "Members can insert library chunks"
  on library_source_chunks for insert with check (is_workspace_member(workspace_id));
create policy "Members can update library chunks"
  on library_source_chunks for update using (is_workspace_member(workspace_id));
create policy "Members can delete library chunks"
  on library_source_chunks for delete using (is_workspace_member(workspace_id));

-- document_versions
alter table document_versions enable row level security;

create policy "Members can select document versions"
  on document_versions for select using (is_workspace_member(workspace_id));
create policy "Members can insert document versions"
  on document_versions for insert with check (is_workspace_member(workspace_id));

-- metadata_schemas
alter table metadata_schemas enable row level security;

create policy "Members can manage metadata schemas"
  on metadata_schemas for all
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

-- templates
alter table templates enable row level security;

create policy "Users can read system and workspace templates"
  on templates for select
  using (
    is_system = true
    or (workspace_id is not null and is_workspace_member(workspace_id))
  );

create policy "Members can manage workspace templates"
  on templates for insert
  with check (workspace_id is not null and is_workspace_member(workspace_id));

create policy "Members can update workspace templates"
  on templates for update
  using (workspace_id is not null and is_workspace_member(workspace_id));

create policy "Members can delete workspace templates"
  on templates for delete
  using (workspace_id is not null and is_workspace_member(workspace_id));

-- views
alter table views enable row level security;

create policy "Members can manage views"
  on views for all
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

-- profiles
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- workspace_invites
alter table workspace_invites enable row level security;

create policy "Admins can manage invites"
  on workspace_invites for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_invites.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_invites.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- subscriptions
alter table subscriptions enable row level security;

create policy "Users can view own subscription"
  on subscriptions for select using (auth.uid() = user_id);

-- webhook_events: service role only (no policies for authenticated)
