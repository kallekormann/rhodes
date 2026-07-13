-- Per-property AI fill opt-in + fix seeded Summary type

alter table metadata_schemas
  add column if not exists ai_fill_enabled boolean not null default false;

-- Summary should be long text, not single-line text
update metadata_schemas
set field_type = 'textarea'
where field_key = 'summary'
  and field_type = 'text';

-- Backfill AI-enabled flags for legacy preset keys
update metadata_schemas
set ai_fill_enabled = true
where field_key in (
  'summary',
  'tags',
  'document_type',
  'due_date',
  'stakeholders',
  'decision_status',
  'confidence',
  'status'
);

create or replace function public.seed_default_metadata_schemas(ws_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
  values
    (ws_id, 'status', 'Status', 'select', '["draft","in_progress","done"]'::jsonb, true),
    (ws_id, 'summary', 'Summary', 'textarea', null, true),
    (ws_id, 'due_date', 'Due', 'date', null, true)
  on conflict (workspace_id, field_key) do nothing;
end;
$$;
