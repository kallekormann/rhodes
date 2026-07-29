-- M2.2: Organizations, scope policies, scope links, collaborators.
-- Private scopes stay org_id NULL; team scopes may optionally belong to an org.

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);
create index organization_members_org_idx on public.organization_members (org_id);

-- ---------------------------------------------------------------------------
-- Scope policies (per workspace or org defaults)
-- ---------------------------------------------------------------------------

create table public.scope_policies (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  policy jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scope_policies_target_check check (
    (workspace_id is not null and org_id is null)
    or (workspace_id is null and org_id is not null)
  )
);

create unique index scope_policies_workspace_unique
  on public.scope_policies (workspace_id)
  where workspace_id is not null;

create unique index scope_policies_org_unique
  on public.scope_policies (org_id)
  where org_id is not null;

-- ---------------------------------------------------------------------------
-- Workspaces: org affiliation + policy link
-- ---------------------------------------------------------------------------

alter table public.workspaces
  add column if not exists org_id uuid references public.organizations(id) on delete set null,
  add column if not exists scope_policy_id uuid references public.scope_policies(id) on delete set null;

alter table public.workspaces
  drop constraint if exists workspaces_org_team_check;

alter table public.workspaces
  add constraint workspaces_org_team_check check (
    org_id is null or is_team_workspace is true
  );

create index workspaces_org_id_idx on public.workspaces (org_id)
  where org_id is not null;

-- ---------------------------------------------------------------------------
-- Cross-scope visibility graph (M7 consumes; M2 stores)
-- ---------------------------------------------------------------------------

create table public.scope_links (
  id uuid primary key default uuid_generate_v4(),
  source_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  target_workspace_id uuid not null references public.workspaces(id) on delete cascade,
  link_type text not null
    check (link_type in ('private_peer', 'org_team', 'org_wide')),
  permissions jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint scope_links_distinct_endpoints check (source_workspace_id <> target_workspace_id),
  unique (source_workspace_id, target_workspace_id, link_type)
);

create index scope_links_source_idx on public.scope_links (source_workspace_id);
create index scope_links_target_idx on public.scope_links (target_workspace_id);

-- ---------------------------------------------------------------------------
-- Scope collaborators (guests — full role model in M2.6)
-- ---------------------------------------------------------------------------

create table public.scope_collaborators (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('viewer', 'member', 'guest')),
  can_invite boolean not null default false,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index scope_collaborators_user_idx on public.scope_collaborators (user_id);

-- ---------------------------------------------------------------------------
-- Profile onboarding flags (M2.1 UI)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists personal_onboarding_completed_at timestamptz,
  add column if not exists org_upgrade_onboarding_pending boolean not null default false,
  add column if not exists org_upgrade_onboarding_completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Helper functions (security definer — avoid RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = target_org_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = target_org_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  );
$$;

create or replace function public.workspace_org_id(ws_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from public.workspaces where id = ws_id;
$$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.workspace_org_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organizations force row level security;

alter table public.organization_members enable row level security;
alter table public.organization_members force row level security;

alter table public.scope_policies enable row level security;
alter table public.scope_policies force row level security;

alter table public.scope_links enable row level security;
alter table public.scope_links force row level security;

alter table public.scope_collaborators enable row level security;
alter table public.scope_collaborators force row level security;

-- organizations
create policy "Org members can select organizations"
  on public.organizations for select
  using (
    public.is_org_member(id)
    or created_by = auth.uid()
  );

create policy "Authenticated users can create organizations"
  on public.organizations for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "Org admins can update organizations"
  on public.organizations for update
  using (public.is_org_admin(id));

create policy "Org owners can delete organizations"
  on public.organizations for delete
  using (
    exists (
      select 1 from public.organization_members om
      where om.org_id = organizations.id
        and om.user_id = auth.uid()
        and om.role = 'owner'
    )
  );

-- organization_members
create policy "Org members can select organization members"
  on public.organization_members for select
  using (public.is_org_member(org_id));

create policy "Org admins can insert organization members"
  on public.organization_members for insert
  with check (public.is_org_admin(org_id));

create policy "Org admins can update organization members"
  on public.organization_members for update
  using (public.is_org_admin(org_id));

create policy "Org admins can delete organization members"
  on public.organization_members for delete
  using (public.is_org_admin(org_id));

-- scope_policies
create policy "Workspace or org members can select scope policies"
  on public.scope_policies for select
  using (
    (workspace_id is not null and public.is_workspace_member(workspace_id))
    or (org_id is not null and public.is_org_member(org_id))
  );

create policy "Workspace or org admins can insert scope policies"
  on public.scope_policies for insert
  with check (
    (workspace_id is not null and public.is_workspace_admin(workspace_id))
    or (org_id is not null and public.is_org_admin(org_id))
  );

create policy "Workspace or org admins can update scope policies"
  on public.scope_policies for update
  using (
    (workspace_id is not null and public.is_workspace_admin(workspace_id))
    or (org_id is not null and public.is_org_admin(org_id))
  );

create policy "Workspace or org admins can delete scope policies"
  on public.scope_policies for delete
  using (
    (workspace_id is not null and public.is_workspace_admin(workspace_id))
    or (org_id is not null and public.is_org_admin(org_id))
  );

-- scope_links
create policy "Workspace members can select scope links"
  on public.scope_links for select
  using (
    public.is_workspace_member(source_workspace_id)
    or public.is_workspace_member(target_workspace_id)
  );

create policy "Source workspace admins can insert scope links"
  on public.scope_links for insert
  with check (public.is_workspace_admin(source_workspace_id));

create policy "Source workspace admins can update scope links"
  on public.scope_links for update
  using (public.is_workspace_admin(source_workspace_id));

create policy "Source workspace admins can delete scope links"
  on public.scope_links for delete
  using (public.is_workspace_admin(source_workspace_id));

-- scope_collaborators
create policy "Collaborators and workspace members can select scope collaborators"
  on public.scope_collaborators for select
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

create policy "Workspace admins can insert scope collaborators"
  on public.scope_collaborators for insert
  with check (public.is_workspace_admin(workspace_id));

create policy "Workspace admins can update scope collaborators"
  on public.scope_collaborators for update
  using (public.is_workspace_admin(workspace_id));

create policy "Workspace admins can delete scope collaborators"
  on public.scope_collaborators for delete
  using (public.is_workspace_admin(workspace_id));

-- Bootstrap: creator becomes org owner on insert
create or replace function public.bootstrap_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.organization_members (org_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (org_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_bootstrap_owner on public.organizations;
create trigger organizations_bootstrap_owner
  after insert on public.organizations
  for each row execute function public.bootstrap_organization_owner();

comment on table public.organizations is 'Optional container for org-affiliated team scopes; billing/policy ceiling (M8).';
comment on table public.scope_policies is 'JSON policy per workspace or org; see docs/30-scope-settings-matrix.md.';
comment on column public.workspaces.org_id is 'NULL = personal world (private or standalone team). Set = org team scope.';
