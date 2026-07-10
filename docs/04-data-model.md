# 04 — Data Model

**Status:** draft

## Context

PostgreSQL (Supabase) with `pgvector` is the single source of truth. Schema must support spaces, documents, library, metadata, versions, templates, and views — with strict RLS.

## Decision

Extend the PRD schema with corrected embedding dimensions (768), metadata tables, document versions, templates, and views. Private spaces auto-provisioned at signup.

## Specification

### Extensions

```sql
create extension if not exists "uuid-ossp";
create extension if not exists vector;
```

### Core tables (from PRD, corrected)

```sql
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
  embedding vector(768),              -- corrected from 1536
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
```

### New tables

```sql
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

-- METADATA SCHEMA (per workspace, user-defined fields)
create table metadata_schemas (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  field_key text not null,
  field_label text not null,
  field_type text not null check (field_type in ('text', 'select', 'date', 'tags', 'number')),
  options jsonb,  -- for select: ["draft", "review", "done"]
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

-- SAVED VIEWS (V1.5)
create table views (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  filter_json jsonb not null,
  sort_json jsonb,
  created_at timestamptz default now() not null
);

-- USER PROFILE & PREFERENCES
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

-- SUBSCRIPTIONS (LemonSqueezy)
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
```

See [22-authentication-and-accounts.md](22-authentication-and-accounts.md), [23-user-settings-and-spaces.md](23-user-settings-and-spaces.md), [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md) for usage.

```sql
-- Legacy user prefs on auth.users (prefer profiles table)
alter table auth.users add column if not exists locale text default 'en';
alter table auth.users add column if not exists theme text default 'system';
```

### Indices

```sql
create index on documents using hnsw (embedding vector_cosine_ops);
create index on library_source_chunks using hnsw (embedding vector_cosine_ops);
create index idx_documents_workspace on documents(workspace_id);
create index idx_chunks_workspace on library_source_chunks(workspace_id);
create index idx_document_versions_doc on document_versions(document_id, created_at desc);
```

### RLS

All content tables use `is_workspace_member(workspace_id)` — same as PRD.

**Private space bootstrap:** on user signup, trigger creates:
1. `workspaces` row (`is_team_workspace = false`, name = "Private")
2. `workspace_members` row (`role = owner`)

### Semantic match RPC (corrected dimensions)

```sql
create or replace function match_workspace_knowledge (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  target_workspace_id uuid
)
returns table (
  origin_type text,
  item_id uuid,
  title text,
  matched_text text,
  page_ref int,
  similarity float
)
language plpgsql stable
as $$
begin
  return query
  select 'document', id, title, content_plain, null::int,
    1 - (embedding <=> query_embedding)
  from documents
  where workspace_id = target_workspace_id
    and embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  union all
  select 'source_chunk', c.id, s.file_name, c.content_chunk, c.page_number,
    1 - (c.embedding <=> query_embedding)
  from library_source_chunks c
  join library_sources s on c.source_id = s.id
  where c.workspace_id = target_workspace_id
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
```

## Open questions

- Soft-delete documents vs hard delete?
- Max metadata fields per workspace?

## Dependencies

- [05-ai-and-rag.md](05-ai-and-rag.md)
- [07-individual-vs-team.md](07-individual-vs-team.md)
- [08-metadata-system.md](08-metadata-system.md)
- [22-authentication-and-accounts.md](22-authentication-and-accounts.md)
- [24-privacy-user-tools.md](24-privacy-user-tools.md)
- [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md)
- [adr/004-embedding-model-768d.md](adr/004-embedding-model-768d.md)
