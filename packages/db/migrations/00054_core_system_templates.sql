-- M2.5.2: refresh core system templates (structure + classification metadata)

-- document_type classifies docs for views / graph / AI — not content fields like attendees.
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
    (
      ws_id,
      'document_type',
      'Document type',
      'select',
      '["note","meeting_notes","product_spec","report"]'::jsonb,
      true
    )
  on conflict (workspace_id, field_key) do nothing;
end;
$$;

-- Backfill document_type schema on existing scopes
insert into metadata_schemas (workspace_id, field_key, field_label, field_type, options, ai_fill_enabled)
select
  w.id,
  'document_type',
  'Document type',
  'select',
  '["note","meeting_notes","product_spec","report"]'::jsonb,
  true
from workspaces w
where not exists (
  select 1
  from metadata_schemas ms
  where ms.workspace_id = w.id
    and ms.field_key = 'document_type'
);

-- Blank
update templates
set
  description = 'Start from an empty page',
  structure_json = '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  metadata = '{
    "use_cases": ["Quick notes", "Freeform drafts", "Anything unstructured"],
    "default_properties": {"status": "draft", "document_type": "note"},
    "supported_views": ["wiki", "kanban", "calendar", "gantt", "dashboard"]
  }'::jsonb
where is_system = true
  and workspace_id is null
  and slug = 'blank';

-- Meeting Notes (renamed from Meeting Minutes)
update templates
set
  name = 'Meeting Notes',
  description = 'Objective, agenda, discussion, and action items',
  structure_json = '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Objective"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "[One sentence on the primary goal of this meeting]"}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Agenda"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Topic 1]"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Topic 2]"}]}]}
      ]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Discussion & Notes"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Key point discussed]"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Decision made regarding X]"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Context or insight shared]"}]}]}
      ]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Action Items"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "@Name – [Task description] – Due: [Date]"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "@Name – [Task description] – Due: [Date]"}]}]}
      ]}
    ]
  }'::jsonb,
  metadata = '{
    "use_cases": ["Team syncs", "Client calls", "Sprint planning", "Decision meetings"],
    "default_properties": {"status": "draft", "document_type": "meeting_notes"},
    "supported_views": ["calendar", "kanban"]
  }'::jsonb
where is_system = true
  and workspace_id is null
  and slug = 'meeting-notes';

-- Product Spec
update templates
set
  description = 'Problem, hypothesis, scope, UX flow, and success metrics',
  structure_json = '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Problem & Insight"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "[Describe the core problem being solved and the underlying user insight or data point that validates this problem.]"}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Hypothesis"}]},
      {"type": "paragraph", "content": [
        {"type": "text", "text": "If we "},
        {"type": "text", "marks": [{"type": "bold"}], "text": "[build/change this feature]"},
        {"type": "text", "text": ", then "},
        {"type": "text", "marks": [{"type": "bold"}], "text": "[this behavior will happen]"},
        {"type": "text", "text": ", because "},
        {"type": "text", "marks": [{"type": "bold"}], "text": "[underlying reasoning]."}
      ]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Goals & Non-Goals"}]},
      {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "In Scope:"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Key deliverable 1]"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Key deliverable 2]"}]}]}
      ]},
      {"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "Out of Scope:"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Explicitly state what is NOT being built right now to prevent scope creep]"}]}]}
      ]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "User Experience & Flow"}]},
      {"type": "orderedList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Step 1 of the user journey]"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Step 2 of the user journey]"}]}]}
      ]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Technical Architecture & Considerations"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Data structure changes, API requirements, or specific frontend/backend constraints]"}]}]}
      ]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Success Metrics"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Primary Metric (Activation/Retention/etc.): [What determines if this was successful?]"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Guardrail Metric: [What should not degrade as a result of this launch?]"}]}]}
      ]}
    ]
  }'::jsonb,
  metadata = '{
    "use_cases": ["Feature specs", "Quarterly planning", "PRD drafts", "Experiment design"],
    "default_properties": {"status": "draft", "document_type": "product_spec"},
    "supported_views": ["kanban", "gantt", "dashboard"]
  }'::jsonb
where is_system = true
  and workspace_id is null
  and slug = 'product-spec';

-- Report
update templates
set
  description = 'Executive summary, findings, analysis, and next steps',
  structure_json = '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Executive Summary"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "[TL;DR: A 2–3 sentence summary of the report''s conclusion. What is the single most important takeaway?]"}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Key Findings & Highlights"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Finding 1]: [Brief explanation and impact]"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Finding 2]: [Brief explanation and impact]"}]}]}
      ]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Detailed Analysis"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "[Deep dive into the data, context, long-term effects, or qualitative feedback that supports the findings above.]"}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Roadblocks & Learnings"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[What didn''t go as expected?]"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[What frictions or costs were encountered?]"}]}]}
      ]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Next Steps"}]},
      {"type": "orderedList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Actionable step based on the findings]"}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Follow-up item]"}]}]}
      ]}
    ]
  }'::jsonb,
  metadata = '{
    "use_cases": ["Weekly status", "Research summaries", "Quarterly reviews", "Experiment readouts"],
    "default_properties": {"status": "draft", "document_type": "report"},
    "supported_views": ["dashboard", "calendar", "gantt"]
  }'::jsonb
where is_system = true
  and workspace_id is null
  and slug = 'report';
