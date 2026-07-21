-- Rich per-chunk metadata for library RAG (location, structure, provenance, display).

alter table library_source_chunks
  add column if not exists chunk_metadata jsonb not null default '{}'::jsonb;

alter table library_source_chunks
  add column if not exists content_hash text;

alter table library_source_chunks
  add column if not exists token_estimate int;

create index if not exists library_source_chunks_content_hash_idx
  on library_source_chunks (source_id, content_hash);

-- Backfill page_number into chunk_metadata for legacy rows.
update library_source_chunks
set chunk_metadata = jsonb_build_object(
  'schema_version', '1',
  'citation', jsonb_strip_nulls(jsonb_build_object('page_number', page_number)),
  'structure', '{}'::jsonb,
  'provenance', jsonb_build_object('extraction_version', 'legacy'),
  'display', '{}'::jsonb
)
where page_number is not null
  and (chunk_metadata = '{}'::jsonb or chunk_metadata is null);
