-- Meeting Notes: ship meeting-oriented properties (not experiment fields).
-- Also seed those fields onto existing workspaces that already use Meeting Notes.

update templates
set
  name = 'Meeting Notes',
  description = 'Objective, agenda, discussion, and action items',
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{schema_fields}',
    '[
      {"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},
      {"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},
      {"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},
      {"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},
      {"field_key":"origin","field_label":"Origin","field_type":"relation","ai_fill_enabled":false},
      {"field_key":"meeting_date","field_label":"Meeting date","field_type":"date","ai_fill_enabled":true},
      {"field_key":"meeting_type","field_label":"Meeting type","field_type":"select","options":["team_sync","client","planning","standup","retro","other"],"ai_fill_enabled":true},
      {"field_key":"attendees","field_label":"Attendees","field_type":"textarea","ai_fill_enabled":true},
      {"field_key":"meeting_link","field_label":"Meeting link","field_type":"text","ai_fill_enabled":false},
      {"field_key":"location","field_label":"Location","field_type":"text","ai_fill_enabled":false}
    ]'::jsonb
  )
where slug = 'meeting-notes'
  and coalesce(is_system, false) = true;

-- Seed new Meeting Notes fields onto workspaces that already have meeting_date
-- (i.e. already adopted Meeting Notes / calendar-style scopes).
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select
  ms.workspace_id,
  v.field_key,
  v.field_label,
  v.field_type,
  v.options,
  v.ai_fill_enabled
from (
  select distinct workspace_id
  from metadata_schemas
  where field_key = 'meeting_date'
) ms
cross join (
  values
    ('meeting_type', 'Meeting type', 'select', '["team_sync","client","planning","standup","retro","other"]'::jsonb, true),
    ('attendees', 'Attendees', 'textarea', null::jsonb, true),
    ('meeting_link', 'Meeting link', 'text', null::jsonb, false),
    ('location', 'Location', 'text', null::jsonb, false)
) as v(field_key, field_label, field_type, options, ai_fill_enabled)
where not exists (
  select 1
  from metadata_schemas existing
  where existing.workspace_id = ms.workspace_id
    and existing.field_key = v.field_key
);
