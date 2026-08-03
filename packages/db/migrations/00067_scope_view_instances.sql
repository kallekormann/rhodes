-- Per-scope configured view instances (View Engine).
-- Bundle ViewPresets seed rows on composition apply; users edit config later.

create table if not exists public.scope_view_instances (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  base_view_type text not null,
  label text not null,
  config jsonb not null default '{}'::jsonb,
  layout jsonb,
  created_from_preset_id text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scope_view_instances_base_view_type_check
    check (
      base_view_type in (
        'kanban',
        'calendar',
        'gantt',
        'dashboard',
        'mindmap',
        'graph',
        'wiki'
      )
    )
);

create index if not exists scope_view_instances_workspace_position_idx
  on public.scope_view_instances (workspace_id, position);

-- Multiple custom instances may have NULL created_from_preset_id (NULLs are distinct).
create unique index if not exists scope_view_instances_workspace_preset_uidx
  on public.scope_view_instances (workspace_id, created_from_preset_id);

comment on table public.scope_view_instances is
  'User-editable view instances seeded from bundle ViewPresets; see docs/35-view-engine-architecture.md.';

comment on column public.scope_view_instances.layout is
  'Mind-Map node positions only: { [document_id]: { x, y } }. Null for other base types.';

alter table public.scope_view_instances enable row level security;
alter table public.scope_view_instances force row level security;

create policy "Members can select scope view instances"
  on public.scope_view_instances for select
  using (public.is_workspace_member(workspace_id));

create policy "Members can insert scope view instances"
  on public.scope_view_instances for insert
  with check (public.is_workspace_member(workspace_id));

create policy "Members can update scope view instances"
  on public.scope_view_instances for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "Owners and admins can delete scope view instances"
  on public.scope_view_instances for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = scope_view_instances.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );
