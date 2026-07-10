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
  select 'document'::text, d.id, d.title, d.content_plain, null::int,
    (1 - (d.embedding <=> query_embedding))::float
  from documents d
  where d.workspace_id = target_workspace_id
    and d.embedding is not null
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  union all
  select 'source_chunk'::text, c.id, s.file_name, c.content_chunk, c.page_number,
    (1 - (c.embedding <=> query_embedding))::float
  from library_source_chunks c
  join library_sources s on c.source_id = s.id
  where c.workspace_id = target_workspace_id
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

grant execute on function public.match_workspace_knowledge(vector, float, int, uuid)
  to authenticated, service_role;
