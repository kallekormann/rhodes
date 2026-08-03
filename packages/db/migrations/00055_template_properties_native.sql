-- M2.5.2 follow-up: Properties-native templates, field tiers, AI fill on seed

-- Seed RPC: support ai_fill_enabled from template/bundle field seeds
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
        when field ? 'options' and jsonb_typeof(field->'options') = 'array'
          then field->'options'
        else null
      end,
      coalesce((field->>'ai_fill_enabled')::boolean, false)
    )
    on conflict (workspace_id, field_key) do nothing;
  end loop;
end;
$$;

grant execute on function public.seed_scope_metadata_fields(uuid, jsonb) to authenticated;

-- Bootstrap essentials for new scopes (no document_type picker)
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
    (ws_id, 'due_date', 'Due', 'date', null, true),
    (ws_id, 'owner', 'Owner', 'text', null, true)
  on conflict (workspace_id, field_key) do nothing;
end;
$$;

-- Remove document_type schema rows (classification lives on documents.metadata only)
delete from metadata_schemas where field_key = 'document_type';

-- Ensure essentials on existing workspaces
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select w.id, v.field_key, v.field_label, v.field_type, v.options, v.ai_fill_enabled
from workspaces w
cross join (
  values
    ('status', 'Status', 'select', '["draft","in_progress","done"]'::jsonb, true),
    ('summary', 'Summary', 'textarea', null::jsonb, true),
    ('due_date', 'Due', 'date', null::jsonb, true),
    ('owner', 'Owner', 'text', null::jsonb, true)
) as v(field_key, field_label, field_type, options, ai_fill_enabled)
where not exists (
  select 1 from metadata_schemas ms
  where ms.workspace_id = w.id and ms.field_key = v.field_key
);

-- blank
update templates
set
  name = 'Blank',
  description = 'Start from an empty page',
  structure_json = '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb,
  metadata = '{"document_type":"note","use_cases":["Quick notes","Freeform drafts","Anything unstructured"],"supported_views":["wiki","kanban","calendar","gantt","dashboard"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true}],"default_properties":{"status":"draft"}}'::jsonb
where is_system = true
  and workspace_id is null
  and slug = 'blank';

-- meeting-notes
update templates
set
  name = 'Meeting Notes',
  description = 'Objective, agenda, discussion, and action items',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Objective"}]},{"type":"paragraph","content":[{"type":"text","text":"One sentence: the primary goal of this meeting.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Goal of this meeting]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Agenda"}]},{"type":"paragraph","content":[{"type":"text","text":"List topics in the order you plan to cover them.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Topic 1]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Topic 2]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Discussion & Notes"}]},{"type":"paragraph","content":[{"type":"text","text":"Capture key points, decisions, and context — not a transcript.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Key point discussed]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Decision made regarding X]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Context or insight shared]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Action Items"}]},{"type":"paragraph","content":[{"type":"text","text":"Who owns what, and by when. Keep owners in the body for now.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"@Name – [Task description] – Due: [Date]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"@Name – [Task description] – Due: [Date]"}]}]}]}]}'::jsonb,
  metadata = '{"document_type":"meeting_notes","use_cases":["Team syncs","Client calls","Sprint planning","Decision meetings"],"supported_views":["calendar","kanban"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"meeting_date","field_label":"Meeting date","field_type":"date","ai_fill_enabled":true}],"default_properties":{"status":"draft"}}'::jsonb
where is_system = true
  and workspace_id is null
  and slug = 'meeting-notes';

-- product-spec
update templates
set
  name = 'Product Spec',
  description = 'Problem, hypothesis, scope, UX flow, and success metrics',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Problem & Insight"}]},{"type":"paragraph","content":[{"type":"text","text":"What problem are we solving, and what evidence validates it?","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Describe the core problem and the user insight or data that validates it.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Hypothesis"}]},{"type":"paragraph","content":[{"type":"text","text":"If / then / because — keep it falsifiable.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"If we "},{"type":"text","text":"[build/change this feature]","marks":[{"type":"bold"}]},{"type":"text","text":", then "},{"type":"text","text":"[this behavior will happen]","marks":[{"type":"bold"}]},{"type":"text","text":", because "},{"type":"text","text":"[underlying reasoning].","marks":[{"type":"bold"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Goals & Non-Goals"}]},{"type":"paragraph","content":[{"type":"text","text":"Be explicit about what is out of scope to prevent creep.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"In Scope:","marks":[{"type":"bold"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Key deliverable 1]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Key deliverable 2]"}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Out of Scope:","marks":[{"type":"bold"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[What we are NOT building right now]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"User Experience & Flow"}]},{"type":"paragraph","content":[{"type":"text","text":"Walk through the journey in order.","marks":[{"type":"italic"}]}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Step 1 of the user journey]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Step 2 of the user journey]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Technical Architecture & Considerations"}]},{"type":"paragraph","content":[{"type":"text","text":"Data, APIs, and constraints that affect the build.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Data structure changes, API requirements, or frontend/backend constraints]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Success Metrics"}]},{"type":"paragraph","content":[{"type":"text","text":"One primary metric and one guardrail that must not degrade.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Primary Metric: [What determines success?]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Guardrail Metric: [What should not degrade?]"}]}]}]}]}'::jsonb,
  metadata = '{"document_type":"product_spec","use_cases":["Feature specs","Quarterly planning","PRD drafts","Experiment design"],"supported_views":["kanban","gantt","dashboard"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"priority","field_label":"Priority","field_type":"select","options":["p0","p1","p2","p3"],"ai_fill_enabled":true},{"field_key":"milestone","field_label":"Milestone","field_type":"text","ai_fill_enabled":true}],"default_properties":{"status":"draft","priority":"p2"}}'::jsonb
where is_system = true
  and workspace_id is null
  and slug = 'product-spec';

-- report
update templates
set
  name = 'Report',
  description = 'Executive summary, findings, analysis, and next steps',
  structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Executive Summary"}]},{"type":"paragraph","content":[{"type":"text","text":"TL;DR in 2–3 sentences — the single most important takeaway.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Conclusion and primary takeaway.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Key Findings & Highlights"}]},{"type":"paragraph","content":[{"type":"text","text":"Lead with impact, not raw data.","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Finding 1]: [Brief explanation and impact]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Finding 2]: [Brief explanation and impact]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Detailed Analysis"}]},{"type":"paragraph","content":[{"type":"text","text":"Evidence, context, and long-term effects that support the findings.","marks":[{"type":"italic"}]}]},{"type":"paragraph","content":[{"type":"text","text":"[Deep dive into data, context, or qualitative feedback supporting the findings.]"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Roadblocks & Learnings"}]},{"type":"paragraph","content":[{"type":"text","text":"What surprised you, and what friction or cost appeared?","marks":[{"type":"italic"}]}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[What didn''t go as expected?]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[What frictions or costs were encountered?]"}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Next Steps"}]},{"type":"paragraph","content":[{"type":"text","text":"Concrete follow-ups, not vague intentions.","marks":[{"type":"italic"}]}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Actionable step based on the findings]"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"[Follow-up item]"}]}]}]}]}'::jsonb,
  metadata = '{"document_type":"report","use_cases":["Weekly status","Research summaries","Quarterly reviews","Experiment readouts"],"supported_views":["dashboard","calendar","gantt"],"schema_fields":[{"field_key":"status","field_label":"Status","field_type":"select","options":["draft","in_progress","done"],"ai_fill_enabled":true},{"field_key":"due_date","field_label":"Due","field_type":"date","ai_fill_enabled":true},{"field_key":"owner","field_label":"Owner","field_type":"text","ai_fill_enabled":true},{"field_key":"summary","field_label":"Summary","field_type":"textarea","ai_fill_enabled":true},{"field_key":"period_end","field_label":"Period end","field_type":"date","ai_fill_enabled":true},{"field_key":"confidence","field_label":"Confidence","field_type":"select","options":["low","medium","high"],"ai_fill_enabled":true}],"default_properties":{"status":"draft"}}'::jsonb
where is_system = true
  and workspace_id is null
  and slug = 'report';

