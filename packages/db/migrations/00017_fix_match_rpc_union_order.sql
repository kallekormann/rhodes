-- Fix ORDER BY on UNION in match_workspace_knowledge (PostgreSQL requires subquery wrapper)

create or replace function public.match_workspace_knowledge (
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
    m.title,
    m.matched_text,
    m.page_ref,
    m.similarity
  from (
    select
      'document'::text as origin_type,
      d.id as item_id,
      d.title,
      d.content_plain as matched_text,
      null::int as page_ref,
      (1 - (d.embedding <=> query_embedding))::float as similarity
    from documents d
    where d.workspace_id = target_workspace_id
      and d.embedding is not null
      and 1 - (d.embedding <=> query_embedding) > match_threshold
    union all
    select
      'source_chunk'::text as origin_type,
      c.id as item_id,
      s.file_name as title,
      c.content_chunk as matched_text,
      c.page_number as page_ref,
      (1 - (c.embedding <=> query_embedding))::float as similarity
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
