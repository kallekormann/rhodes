-- Fix: metadata_schemas_field_type_check predates the `status`/`relation` field
-- types added alongside the Growth & Experimentation / Product Architecture bundles,
-- so seeding any bundle metadata field of those types (e.g. via seed_scope_metadata_fields)
-- violates the constraint and the whole scope-creation request 400s.

alter table metadata_schemas
  drop constraint if exists metadata_schemas_field_type_check;

alter table metadata_schemas
  add constraint metadata_schemas_field_type_check
  check (
    field_type in (
      'text',
      'textarea',
      'select',
      'multi_select',
      'date',
      'date_range',
      'tags',
      'number',
      'url',
      'checkbox',
      'status',
      'relation'
    )
  );

-- Also carry ai_fill_enabled and object-shaped options (e.g. {"unit": "days"}, or
-- status option arrays of {value,label,category}) through bundle metadata seeding —
-- the previous version silently dropped ai_fill_enabled and non-array options.
create or replace function public.seed_scope_metadata_fields(
  ws_id uuid,
  fields jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  field jsonb;
begin
  if fields is null or jsonb_typeof(fields) <> 'array' then
    return;
  end if;

  for field in select * from jsonb_array_elements(fields)
  loop
    insert into metadata_schemas (
      workspace_id,
      field_key,
      field_label,
      field_type,
      options,
      ai_fill_enabled
    )
    values (
      ws_id,
      field->>'field_key',
      field->>'field_label',
      coalesce(field->>'field_type', 'text'),
      case
        when field ? 'options' and field->'options' is not null and jsonb_typeof(field->'options') <> 'null'
          then field->'options'
        else null
      end,
      coalesce((field->>'ai_fill_enabled')::boolean, false)
    )
    on conflict (workspace_id, field_key) do nothing;
  end loop;
end;
$$;
