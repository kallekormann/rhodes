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
];

export function getScopeTemplateLabel(slug: string): string {
  return (
    SYSTEM_SCOPE_TEMPLATE_CATALOG.find((entry) => entry.slug === slug)?.label ??
    slug.replace(/-/g, " ")
  );
}
