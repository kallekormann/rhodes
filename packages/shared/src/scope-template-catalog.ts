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
    slug: "ticket",
    label: "Ticket",
    description:
      "Lightweight Kanban work item — context, acceptance criteria, and notes",
  },
  {
    slug: "meeting-notes",
    label: "Meeting Notes",
    description: "Objective, agenda, discussion, and action items",
  },
  {
    slug: "product-spec",
    label: "Product Spec",
    description:
      "Hypothesis-driven growth/feature spec — for experiments and data-backed bets",
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
    description:
      "Delivery PRD for larger core epics — MoSCoW scope and user stories",
  },
  {
    slug: "product-feature",
    label: "Product Feature",
    description:
      "Tactical one-pager for bounded features with acceptance criteria",
  },
  {
    slug: "user-flow-definition",
    label: "User Flow Definition",
    description:
      "Happy path, decisions, edge cases, and success state for one user task",
  },
  {
    slug: "swot-analysis",
    label: "SWOT Analysis",
    description:
      "Scoped SWOT with strategic implications and freshness tracking",
  },
  {
    slug: "project-charter",
    label: "Project Charter",
    description:
      "Executive buy-in charter — objective, sponsor, risks, and milestones",
  },
  {
    slug: "gtm-plan",
    label: "GTM Plan",
    description:
      "ICP, positioning, channels, internal enablement, and launch metrics",
  },
  {
    slug: "launch-checklist",
    label: "Launch Checklist",
    description: "Readiness tasks, go/no-go criteria, and rollback plan",
  },
  {
    slug: "weekly-status",
    label: "Status Report",
    description:
      "Metrics, wins, blockers, and next steps — TL;DR in Properties Summary",
  },
  {
    slug: "campaign-brief",
    label: "Campaign Brief",
    description:
      "Single key message, channels, budget, creative assets, and success metrics",
  },
  {
    slug: "editorial-calendar",
    label: "Content Calendar Item",
    description:
      "Campaign-linked brief, angle, outline, draft, SEO meta, funnel stage, and distribution",
  },
  {
    slug: "seo-brief",
    label: "SEO Brief",
    description:
      "Keyword volume/difficulty, SERP strategy, competing pages, and on-page outline",
  },
  {
    slug: "social-post-batch",
    label: "Social Post Batch",
    description:
      "Reviewable batch of posts with media links, hashtags, and performance-to-insight loop",
  },
  {
    slug: "digital-maturity-audit",
    label: "Digital Maturity Audit",
    description:
      "Scored maturity dimensions with gap analysis and roadmap into charter/PRD work",
  },
  {
    slug: "general-audit",
    label: "General Audit",
    description:
      "Executive-first audit with risk-rated findings and an action plan",
  },
  {
    slug: "business-plan",
    label: "Business Plan",
    description:
      "Executive summary, market, GTM, model, funding/ARR targets, and financials",
  },
  {
    slug: "professional-business-letter",
    label: "Professional Business Letter",
    description: "Subject line, salutation, body, enclosures, and formal closing",
  },
  {
    slug: "one-on-one-notes",
    label: "1:1 Notes",
    description:
      "Private check-in notes with career topics, actions, and next-meeting continuity",
  },
  {
    slug: "personal-development-plan",
    label: "Personal Development Plan",
    description:
      "Career goals, skill table, support needed, and a binding check-in cadence",
  },
  {
    slug: "job-description",
    label: "Job Description",
    description:
      "Role purpose, impact-oriented responsibilities, requirements, and compensation",
  },
  {
    slug: "performance-review",
    label: "Performance Review",
    description:
      "Calibration pipeline with evidence-based goals and PDP-linked growth areas",
  },
  {
    slug: "legal-document",
    label: "Legal Document",
    description:
      "Parties, terms, obligations, termination/renewal, and signatures",
  },
  {
    slug: "contract-review",
    label: "Contract Review",
    description:
      "Intake-to-approval review with key terms, redlines, and liability/privacy checks",
  },
  {
    slug: "compliance-checklist",
    label: "Compliance Checklist",
    description:
      "Framework requirements with evidence links, gaps, and remediation owners",
  },
  {
    slug: "financial-report",
    label: "Financial Report",
    description:
      "Period summary, key figures vs baseline, variances, and outlook",
  },
  {
    slug: "research-paper",
    label: "Research Paper",
    description:
      "IMRAD paper with related work, limitations-aware discussion, and references",
  },
  {
    slug: "thesis",
    label: "Thesis",
    description:
      "Full thesis lifecycle including defense Q&A prep and advisor link",
  },
  {
    slug: "student-essay",
    label: "Student Essay",
    description: "Thesis statement, argument, counterarguments, and conclusion",
  },
  {
    slug: "literature-review",
    label: "Literature Review",
    description:
      "Replicable search scope, source table, thematic synthesis, and gaps",
  },
];

export function getScopeTemplateLabel(slug: string): string {
  return (
    SYSTEM_SCOPE_TEMPLATE_CATALOG.find((entry) => entry.slug === slug)?.label ??
    slug.replace(/-/g, " ")
  );
}
