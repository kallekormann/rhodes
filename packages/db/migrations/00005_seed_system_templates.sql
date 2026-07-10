insert into templates (name, description, structure_json, is_system, is_shared)
values
  (
    'Blank',
    'Empty document',
    '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
    true,
    true
  ),
  (
    'Meeting Minutes',
    'Attendees, Agenda, Notes, Action Items',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Meeting Minutes"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Attendees"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Agenda"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Notes"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Action Items"}]},{"type":"paragraph"}]}'::jsonb,
    true,
    true
  ),
  (
    'Report',
    'Summary, Findings, Recommendations',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Report"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Summary"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Findings"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Recommendations"}]},{"type":"paragraph"}]}'::jsonb,
    true,
    true
  ),
  (
    'Product Spec',
    'Problem, Goals, Requirements, Out of Scope',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Product Spec"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Problem"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Goals"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Requirements"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Out of Scope"}]},{"type":"paragraph"}]}'::jsonb,
    true,
    true
  );
