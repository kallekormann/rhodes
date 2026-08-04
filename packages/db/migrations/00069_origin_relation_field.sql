-- Seed Origin (relation) on every existing workspace so documents can link to a parent/source.
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select
  w.id,
  'origin',
  'Origin',
  'relation',
  null,
  false
from workspaces w
where not exists (
  select 1
  from metadata_schemas ms
  where ms.workspace_id = w.id
    and ms.field_key = 'origin'
);
