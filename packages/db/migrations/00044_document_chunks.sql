-- Fine-grained chunks for workspace documents (personal + team scopes).

create table if not exists document_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade not null,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  chunk_index int not null,
  content_chunk text not null,
  embedding vector(768),
  embedding_model_version text default 'nomic-embed-text-v1',
  content_hash text,
  token_estimate int,
  chunk_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now() not null,
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_workspace_idx
  on document_chunks (workspace_id);

create index if not exists document_chunks_document_idx
  on document_chunks (document_id);

create index if not exists document_chunks_embedding_idx
  on document_chunks using hnsw (embedding vector_cosine_ops);

alter table document_chunks enable row level security;
alter table document_chunks force row level security;

create policy "Members can select document chunks"
  on document_chunks for select
  using (public.is_workspace_member(workspace_id));

create policy "Writers can insert document chunks"
  on document_chunks for insert
  with check (public.can_write_workspace(workspace_id));

create policy "Writers can update document chunks"
  on document_chunks for update
  using (public.can_write_workspace(workspace_id));

create policy "Writers can delete document chunks"
  on document_chunks for delete
  using (public.can_write_workspace(workspace_id));

-- Extend match RPC to return chunk_metadata and search document_chunks.
drop function if exists public.match_workspace_knowledge(vector, float, int, uuid);

create or replace function public.match_workspace_knowledge (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  target_workspace_id uuid
)
returns table (
  origin_type text,
  item_id uuid,
  source_ref_id uuid,
  title text,
  matched_text text,
  page_ref int,
  similarity float,
  chunk_metadata jsonb,
  source_summary text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not is_workspace_member(target_workspace_id) then
    raise exception 'not a workspace member';
  end if;

  return query
  select
    m.origin_type,
    m.item_id,
    m.source_ref_id,
    m.title,
    m.matched_text,
    m.page_ref,
    m.similarity,
    m.chunk_metadata,
    m.source_summary
  from (
    select
      'document_chunk'::text as origin_type,
      c.id as item_id,
      d.id as source_ref_id,
      d.title,
      c.content_chunk as matched_text,
      null::int as page_ref,
      (1 - (c.embedding <=> query_embedding))::float as similarity,
      c.chunk_metadata,
      null::text as source_summary
    from document_chunks c
    join documents d on d.id = c.document_id
    where c.workspace_id = target_workspace_id
      and c.embedding is not null
      and 1 - (c.embedding <=> query_embedding) > match_threshold

    union all

    -- Legacy whole-document embeddings (until all docs are re-chunked).
    select
      'document'::text as origin_type,
      d.id as item_id,
      d.id as source_ref_id,
      d.title,
      left(coalesce(d.content_plain, ''), 2000) as matched_text,
      null::int as page_ref,
      (1 - (d.embedding <=> query_embedding))::float as similarity,
      '{}'::jsonb as chunk_metadata,
      null::text as source_summary
    from documents d
    where d.workspace_id = target_workspace_id
      and d.embedding is not null
      and not exists (
        select 1 from document_chunks dc
        where dc.document_id = d.id and dc.embedding is not null
      )
      and 1 - (d.embedding <=> query_embedding) > match_threshold

    union all

    select
      'source_chunk'::text as origin_type,
      c.id as item_id,
      s.id as source_ref_id,
      s.file_name as title,
      c.content_chunk as matched_text,
      coalesce(
        (c.chunk_metadata -> 'citation' ->> 'page_number')::int,
        c.page_number
      ) as page_ref,
      (1 - (c.embedding <=> query_embedding))::float as similarity,
      c.chunk_metadata,
      left(coalesce(s.summary, ''), 400) as source_summary
    from library_source_chunks c
    join library_sources s on c.source_id = s.id
    where c.workspace_id = target_workspace_id
      and c.embedding is not null
      and 1 - (c.embedding <=> query_embedding) > match_threshold
  ) m
  order by m.similarity desc
  limit match_count;
end;
$$;

grant execute on function public.match_workspace_knowledge(vector, float, int, uuid)
  to authenticated, service_role;
