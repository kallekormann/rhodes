-- Property groups: named blocks with sub-properties + repeatable instances on documents

create table metadata_schema_groups (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  group_key text not null,
  group_label text not null,
  repeatable boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now() not null,
  unique (workspace_id, group_key)
);

alter table metadata_schemas
  add column if not exists group_id uuid references metadata_schema_groups(id) on delete cascade,
  add column if not exists sub_key text,
  add column if not exists sort_order int not null default 0;

create index if not exists metadata_schemas_group_id_idx
  on metadata_schemas (group_id)
  where group_id is not null;

alter table metadata_schema_groups enable row level security;

create policy "Members can manage metadata schema groups"
  on metadata_schema_groups for all
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));
