-- SPACES
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  is_team_workspace boolean default false,
  created_at timestamptz default now() not null
);

create table workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text check (role in ('owner', 'admin', 'member')) default 'member',
  created_at timestamptz default now() not null,
  unique (workspace_id, user_id)
);

-- DOCUMENTS
create table documents (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null default 'Untitled Document',
  content jsonb,
  content_plain text,
  embedding vector(768),
  embedding_model_version text default 'nomic-embed-text-v1',
  detected_language text default 'en',
  metadata jsonb default '{}',
  updated_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

-- LIBRARY
create table library_sources (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_type text,
  summary text,
  detected_language text,
  metadata jsonb default '{}',
  embedding_status text default 'pending'
    check (embedding_status in ('pending', 'processing', 'ready', 'failed')),
  created_at timestamptz default now() not null
);

create table library_source_chunks (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid references library_sources(id) on delete cascade not null,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  chunk_index int not null,
  page_number int,
  content_chunk text not null,
  embedding vector(768),
  embedding_model_version text default 'nomic-embed-text-v1',
  created_at timestamptz default now() not null
);

-- DOCUMENT VERSIONS
create table document_versions (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade not null,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  content jsonb not null,
  content_plain text,
  changed_by uuid references auth.users(id) on delete set null,
  change_summary text,
  created_at timestamptz default now() not null
);

-- METADATA SCHEMA
create table metadata_schemas (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  field_key text not null,
  field_label text not null,
  field_type text not null check (field_type in ('text', 'select', 'date', 'tags', 'number')),
  options jsonb,
  created_at timestamptz default now() not null,
  unique (workspace_id, field_key)
);

-- TEMPLATES
create table templates (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  description text,
  structure_json jsonb not null,
  is_system boolean default false,
  is_shared boolean default false,
  created_at timestamptz default now() not null
);

-- SAVED VIEWS
create table views (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  filter_json jsonb not null,
  sort_json jsonb,
  created_at timestamptz default now() not null
);

-- USER PROFILE
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text default 'UTC',
  email_preferences jsonb default '{"knowledge_bridge": true}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- WORKSPACE INVITES
create table workspace_invites (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  email text not null,
  role text check (role in ('admin', 'member')) default 'member',
  invited_by uuid references auth.users(id),
  token text unique not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- SUBSCRIPTIONS
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lemonsqueezy_customer_id text,
  lemonsqueezy_subscription_id text unique,
  variant_id text not null,
  status text not null,
  tier text not null check (tier in ('free', 'pro', 'team')),
  seats int default 1,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- WEBHOOK IDEMPOTENCY
create table webhook_events (
  id uuid primary key default uuid_generate_v4(),
  source text not null,
  event_id text unique not null,
  payload jsonb,
  processed_at timestamptz default now()
);

-- User locale/theme live on profiles; auth.users extensions added in Phase 03.
create index documents_embedding_idx on documents using hnsw (embedding vector_cosine_ops);
create index library_source_chunks_embedding_idx on library_source_chunks using hnsw (embedding vector_cosine_ops);
create index idx_documents_workspace on documents(workspace_id);
create index idx_chunks_workspace on library_source_chunks(workspace_id);
create index idx_document_versions_doc on document_versions(document_id, created_at desc);
