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
];

export function getScopeTemplateLabel(slug: string): string {
  return (
    SYSTEM_SCOPE_TEMPLATE_CATALOG.find((entry) => entry.slug === slug)?.label ??
    slug.replace(/-/g, " ")
  );
}
