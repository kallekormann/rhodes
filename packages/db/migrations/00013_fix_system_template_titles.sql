-- System templates should not repeat their title as the first heading in body content.

update templates
set structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Attendees"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Agenda"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Notes"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Action Items"}]},{"type":"paragraph"}]}'::jsonb
where is_system = true and name = 'Meeting Minutes';

update templates
set structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Summary"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Findings"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Recommendations"}]},{"type":"paragraph"}]}'::jsonb
where is_system = true and name = 'Report';

update templates
set structure_json = '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Problem"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Goals"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Requirements"}]},{"type":"paragraph"},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Out of Scope"}]},{"type":"paragraph"}]}'::jsonb
where is_system = true and name = 'Product Spec';
