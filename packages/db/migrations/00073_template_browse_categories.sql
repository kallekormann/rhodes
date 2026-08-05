-- Stamp browse category onto system template metadata (Templates page tabs).
-- UI also resolves category from SYSTEM_TEMPLATE_SEEDS by slug; this keeps DB metadata aligned.

update templates
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{category}',
  to_jsonb(v.category)
)
from (
  values
    ('blank', 'essentials'),
    ('meeting-notes', 'essentials'),
    ('report', 'essentials'),
    ('weekly-status', 'essentials'),
    ('product-spec', 'product'),
    ('prd', 'product'),
    ('product-feature', 'product'),
    ('user-flow-definition', 'product'),
    ('adr', 'product'),
    ('technical-requirements-document', 'product'),
    ('workflow-definition', 'product'),
    ('insight', 'product'),
    ('problem', 'product'),
    ('ab-experiment', 'product'),
    ('scientific-experiment', 'product'),
    ('swot-analysis', 'product'),
    ('project-charter', 'marketing'),
    ('gtm-plan', 'marketing'),
    ('launch-checklist', 'marketing'),
    ('campaign-brief', 'marketing'),
    ('editorial-calendar', 'marketing'),
    ('seo-brief', 'marketing'),
    ('social-post-batch', 'marketing'),
    ('sop', 'operations'),
    ('onboarding-guide', 'operations'),
    ('policy-document', 'operations'),
    ('one-on-one-notes', 'operations'),
    ('personal-development-plan', 'operations'),
    ('job-description', 'operations'),
    ('performance-review', 'operations'),
    ('digital-maturity-audit', 'professional'),
    ('general-audit', 'professional'),
    ('business-plan', 'professional'),
    ('professional-business-letter', 'professional'),
    ('legal-document', 'professional'),
    ('contract-review', 'professional'),
    ('compliance-checklist', 'professional'),
    ('financial-report', 'professional'),
    ('research-paper', 'professional'),
    ('thesis', 'professional'),
    ('student-essay', 'professional'),
    ('literature-review', 'professional')
) as v(slug, category)
where templates.slug = v.slug
  and coalesce(templates.is_system, false) = true
  and templates.workspace_id is null;
