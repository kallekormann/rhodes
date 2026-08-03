/** System templates selectable in ScopeSetupWizard (M2.5 seeds). */
export type ScopeTemplateCatalogEntry = {
  slug: string;
  label: string;
  description: string;
};

export const SYSTEM_SCOPE_TEMPLATE_CATALOG: readonly ScopeTemplateCatalogEntry[] = [
  {
    slug: "blank",
    label: "Blank",
    description: "Start from an empty page",
  },
  {
    slug: "meeting-notes",
    label: "Meeting Notes",
    description: "Objective, agenda, discussion, and action items",
  },
  {
    slug: "product-spec",
    label: "Product Spec",
    description: "Problem, hypothesis, scope, UX flow, and success metrics",
  },
  {
    slug: "report",
    label: "Report",
    description: "Executive summary, findings, analysis, and next steps",
  },
  {
    slug: "sop",
    label: "SOP",
    description: "Purpose, scope, procedure, roles, and exceptions",
  },
  {
    slug: "onboarding-guide",
    label: "Onboarding Guide",
    description: "Welcome, first week, tools & access, and checkpoints",
  },
  {
    slug: "policy-document",
    label: "Policy Document",
    description: "Statement, applicability, requirements, enforcement, and review",
  },
  {
    slug: "ab-experiment",
    label: "A/B Experiment",
    description: "Hypothesis, target segment, success metrics, and variations",
  },
  {
    slug: "insight",
    label: "Insight",
    description: "Core insight, evidence, and confidence — feeds the experiment backlog",
  },
  {
    slug: "problem",
    label: "Problem",
    description: "Problem statement, impact, and evidence — feeds the experiment backlog",
  },
  {
    slug: "scientific-experiment",
    label: "Scientific Experiment",
    description: "Hypothesis, methodology, variables, results, and conclusion",
  },
  {
    slug: "adr",
    label: "Architecture Decision Record",
    description: "Context, decision, alternatives, and consequences of a technical choice",
  },
  {
    slug: "technical-requirements-document",
    label: "Technical Requirements Document",
    description: "Functional and non-functional requirements, dependencies, and risks",
  },
  {
    slug: "workflow-definition",
    label: "Workflow Definition",
    description: "A repeatable process — trigger, steps, roles, and exceptions",
  },
  {
    slug: "prd",
    label: "Product Requirements Document",
    description: "Problem, scope, requirements, and what's explicitly out",
  },
  {
    slug: "product-feature",
    label: "Product Feature",
    description: "Problem, proposed solution, acceptance criteria, and success metrics",
  },
  {
    slug: "user-flow-definition",
    label: "User Flow Definition",
    description: "Goal, steps, edge cases, and success state for a user journey",
  },
  {
    slug: "swot-analysis",
    label: "SWOT Analysis",
    description: "Strengths, weaknesses, opportunities, and threats for a product or strategy",
  },
  {
    slug: "project-charter",
    label: "Project Charter",
    description: "Objective, scope, stakeholders, milestones, and success criteria",
  },
  {
    slug: "gtm-plan",
    label: "GTM Plan",
    description: "Positioning, audience, channels, and success metrics for a launch",
  },
  {
    slug: "launch-checklist",
    label: "Launch Checklist",
    description: "Readiness tasks, go/no-go criteria, and rollback plan",
  },
  {
    slug: "weekly-status",
    label: "Status Report",
    description: "Summary, key metrics, wins, risks, and next steps for a reporting period",
  },
  {
    slug: "campaign-brief",
    label: "Campaign Brief",
    description: "Objective, audience, channels, timeline, and success metrics for a campaign",
  },
  {
    slug: "editorial-calendar",
    label: "Content Calendar Item",
    description: "Brief, outline, SEO keywords, and distribution for a single piece of content",
  },
  {
    slug: "seo-brief",
    label: "SEO Brief",
    description: "Target keyword, search intent, competing pages, and content outline",
  },
  {
    slug: "social-post-batch",
    label: "Social Post Batch",
    description: "A batch of scheduled posts across platforms, with copy and performance notes",
  },
  {
    slug: "digital-maturity-audit",
    label: "Digital Maturity Audit",
    description: "Score maturity dimensions, surface findings, and recommend a roadmap",
  },
  {
    slug: "general-audit",
    label: "General Audit",
    description: "Scope, findings by risk level, executive summary, and action plan",
  },
  {
    slug: "business-plan",
    label: "Business Plan",
    description: "Executive summary, market analysis, business model, and financial projections",
  },
  {
    slug: "professional-business-letter",
    label: "Professional Business Letter",
    description: "Salutation, body, and closing for a formal business letter",
  },
  {
    slug: "one-on-one-notes",
    label: "1:1 Notes",
    description: "Check-in, topics discussed, action items, and notes for next time",
  },
  {
    slug: "personal-development-plan",
    label: "Personal Development Plan",
    description: "Career goals, skill development areas, and a check-in schedule",
  },
  {
    slug: "job-description",
    label: "Job Description",
    description: "Role summary, responsibilities, requirements, and compensation",
  },
  {
    slug: "performance-review",
    label: "Performance Review",
    description: "Summary, goals and achievements, strengths, growth areas, and next-period goals",
  },
];

export function getScopeTemplateLabel(slug: string): string {
  return (
    SYSTEM_SCOPE_TEMPLATE_CATALOG.find((entry) => entry.slug === slug)?.label ??
    slug.replace(/-/g, " ")
  );
}
