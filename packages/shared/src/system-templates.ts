/**
 * System template seeds (M2.5.2+) — TipTap body + Properties-native schema_fields.
 * document_type is classification (Tier A), not a schema picker.
 */

import type { MetadataFieldSeed } from "./scope-bundles";

export type SystemTemplateSlug =
  | "blank"
  | "meeting-notes"
  | "product-spec"
  | "report"
  | "sop"
  | "onboarding-guide"
  | "policy-document"
  | "ab-experiment"
  | "insight"
  | "problem"
  | "scientific-experiment"
  | "adr"
  | "technical-requirements-document"
  | "workflow-definition"
  | "prd"
  | "product-feature"
  | "user-flow-definition"
  | "swot-analysis"
  | "project-charter"
  | "gtm-plan"
  | "launch-checklist"
  | "weekly-status"
  | "campaign-brief"
  | "editorial-calendar"
  | "seo-brief"
  | "social-post-batch"
  | "digital-maturity-audit"
  | "general-audit"
  | "business-plan"
  | "professional-business-letter"
  | "one-on-one-notes"
  | "personal-development-plan"
  | "job-description"
  | "performance-review"
  | "legal-document"
  | "contract-review"
  | "compliance-checklist"
  | "financial-report"
  | "research-paper"
  | "thesis"
  | "student-essay"
  | "literature-review";

export type TemplateSchemaFieldSeed = MetadataFieldSeed & {
  ai_fill_enabled?: boolean;
};

export type SystemTemplateSeed = {
  slug: SystemTemplateSlug;
  name: string;
  description: string;
  structure_json: Record<string, unknown>;
  metadata: {
    document_type: string;
    use_cases: string[];
    supported_views: string[];
    schema_fields: TemplateSchemaFieldSeed[];
    default_properties: Record<string, string | number | boolean | null>;
  };
};

/** Essentials every template ships — soft-locked from delete in Properties Manage. */
export const ESSENTIAL_TEMPLATE_FIELD_KEYS = [
  "status",
  "due_date",
  "owner",
  "summary",
] as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  meeting_notes: "Meeting Notes",
  product_spec: "Product Spec",
  report: "Report",
  sop: "SOP",
  onboarding_guide: "Onboarding Guide",
  policy: "Policy",
  ab_experiment: "A/B Experiment",
  insight: "Insight",
  problem: "Problem",
  scientific_experiment: "Scientific Experiment",
  adr: "Architecture Decision Record",
  technical_requirements_document: "Technical Requirements Document",
  workflow_definition: "Workflow Definition",
  prd: "Product Requirements Document",
  product_feature: "Product Feature",
  user_flow_definition: "User Flow Definition",
  swot_analysis: "SWOT Analysis",
  project_charter: "Project Charter",
  gtm_plan: "GTM Plan",
  launch_checklist: "Launch Checklist",
  weekly_status: "Status Report",
  campaign_brief: "Campaign Brief",
  editorial_calendar: "Content Calendar Item",
  seo_brief: "SEO Brief",
  social_post_batch: "Social Post Batch",
  digital_maturity_audit: "Digital Maturity Audit",
  general_audit: "General Audit",
  business_plan: "Business Plan",
  professional_business_letter: "Professional Business Letter",
  one_on_one_notes: "1:1 Notes",
  personal_development_plan: "Personal Development Plan",
  job_description: "Job Description",
  performance_review: "Performance Review",
  legal_document: "Legal Document",
  contract_review: "Contract Review",
  compliance_checklist: "Compliance Checklist",
  financial_report: "Financial Report",
  research_paper: "Research Paper",
  thesis: "Thesis",
  student_essay: "Student Essay",
  literature_review: "Literature Review",
};

const ESSENTIAL_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "status",
    field_label: "Status",
    field_type: "select",
    options: ["draft", "in_progress", "done"],
    ai_fill_enabled: true,
  },
  {
    field_key: "due_date",
    field_label: "Due",
    field_type: "date",
    ai_fill_enabled: true,
  },
  {
    field_key: "owner",
    field_label: "Owner",
    field_type: "text",
    ai_fill_enabled: true,
  },
  {
    field_key: "summary",
    field_label: "Summary",
    field_type: "textarea",
    ai_fill_enabled: true,
  },
];

/** Growth discovery fields — shared by Insight / Problem. */
const GROWTH_DISCOVERY_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "state",
    field_label: "State",
    field_type: "status",
    options: [
      { value: "raw", label: "Raw", category: "unstarted" },
      { value: "validating", label: "Validating", category: "started" },
      { value: "actioned", label: "Actioned", category: "completed" },
      { value: "discarded", label: "Discarded", category: "canceled" },
    ],
    ai_fill_enabled: true,
  },
  {
    field_key: "source_type",
    field_label: "Source type",
    field_type: "select",
    options: ["user_interview", "quantitative_analytics", "market_research", "support_tickets"],
    ai_fill_enabled: true,
  },
  {
    field_key: "confidence_level",
    field_label: "Confidence level",
    field_type: "select",
    options: ["low", "medium", "high"],
    ai_fill_enabled: true,
  },
  {
    field_key: "product_area",
    field_label: "Product area",
    field_type: "text",
    ai_fill_enabled: true,
  },
];

/** Knowledge Base & Ops use-case fields — shared by SOP / Onboarding Guide / Policy Document. */
const KB_OPS_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "verification_status",
    field_label: "Verification status",
    field_type: "select",
    options: ["verified", "needs_review", "outdated"],
    ai_fill_enabled: true,
  },
  {
    field_key: "last_audited",
    field_label: "Last audited",
    field_type: "date",
    ai_fill_enabled: true,
  },
  {
    field_key: "review_cycle",
    field_label: "Review cycle",
    field_type: "select",
    options: ["monthly", "quarterly", "biannual", "annual"],
    ai_fill_enabled: false,
  },
];

/** Product Architecture & Decisions fields — shared by ADR / Technical Requirements Document. */
const PRODUCT_ARCHITECTURE_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "impact_area",
    field_label: "Impact area",
    field_type: "multi_select",
    options: ["frontend", "backend", "database", "infrastructure"],
    ai_fill_enabled: true,
  },
];

/** Product Discovery & UX fields — shared by PRD / Product Feature / User Flow Definition. */
const PRODUCT_DISCOVERY_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "product_area",
    field_label: "Product area",
    field_type: "select",
    options: ["core_app", "browser_extension", "admin_panel", "api"],
    ai_fill_enabled: true,
  },
  {
    field_key: "target_release",
    field_label: "Target release",
    field_type: "text",
    ai_fill_enabled: false,
  },
];

/** GTM & Project Execution fields — shared by Project Charter / GTM Plan. */
const GTM_PROJECT_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "sponsor",
    field_label: "Sponsor",
    field_type: "text",
    ai_fill_enabled: true,
  },
];

/** Content & Campaign Marketing fields — shared by Content Calendar Item / SEO Brief / Social Post Batch. */
const CONTENT_MARKETING_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "campaign",
    field_label: "Campaign",
    field_type: "relation",
    ai_fill_enabled: false,
  },
];

/** Strategy & Consulting fields — shared by the two audit templates and Business Plan. */
const STRATEGY_CONSULTING_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "client",
    field_label: "Client",
    field_type: "text",
    ai_fill_enabled: true,
  },
];

/** Shared audit lifecycle — Digital Maturity Audit / General Audit. */
const AUDIT_STATUS_FIELD: TemplateSchemaFieldSeed = {
  field_key: "audit_status",
  field_label: "Audit status",
  field_type: "status",
  options: [
    { value: "scoping", label: "Scoping", category: "unstarted" },
    { value: "in_progress", label: "In progress", category: "started" },
    { value: "report_drafted", label: "Report drafted", category: "started" },
    { value: "delivered", label: "Delivered", category: "completed" },
  ],
  ai_fill_enabled: true,
};

/** People Operations & HR fields — shared by Personal Development Plan / Performance Review. */
const PEOPLE_OPS_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "employee",
    field_label: "Employee",
    field_type: "text",
    ai_fill_enabled: true,
  },
  {
    field_key: "review_period",
    field_label: "Review period",
    field_type: "text",
    ai_fill_enabled: false,
  },
];

/** Legal, Compliance & Finance fields — shared by Legal Document / Contract Review. */
const LEGAL_FINANCE_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "jurisdiction",
    field_label: "Jurisdiction",
    field_type: "text",
    ai_fill_enabled: true,
  },
];

/** Academic & Scientific Research fields — shared by Research Paper / Thesis / Literature Review. */
const ACADEMIC_RESEARCH_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "citation_style",
    field_label: "Citation style",
    field_type: "select",
    options: ["apa", "mla", "chicago", "ieee"],
    ai_fill_enabled: true,
  },
];

type TipTapText = { type: "text"; text: string; marks?: { type: string }[] };
type TipTapNode = { type: string; attrs?: Record<string, unknown>; content?: TipTapNode[] };

function text(value: string, bold = false, italic = false): TipTapText {
  const marks: { type: string }[] = [];
  if (bold) marks.push({ type: "bold" });
  if (italic) marks.push({ type: "italic" });
  return marks.length > 0
    ? { type: "text", text: value, marks }
    : { type: "text", text: value };
}

function heading(level: 2 | 3, label: string): TipTapNode {
  return { type: "heading", attrs: { level }, content: [text(label)] };
}

function paragraph(...parts: TipTapText[]): TipTapNode {
  return { type: "paragraph", content: parts.length > 0 ? parts : [] };
}

/** Italic tip under a section — guidance the user replaces or deletes. */
function tip(guidance: string): TipTapNode {
  return paragraph(text(guidance, false, true));
}

function bullet(items: string[]): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(text(item))],
    })),
  };
}

function ordered(items: string[]): TipTapNode {
  return {
    type: "orderedList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(text(item))],
    })),
  };
}

function doc(...nodes: TipTapNode[]): Record<string, unknown> {
  return { type: "doc", content: nodes };
}

function tableRow(cells: string[], header = false): TipTapNode {
  return {
    type: "tableRow",
    content: cells.map((cell) => ({
      type: header ? "tableHeader" : "tableCell",
      content: [paragraph(text(cell))],
    })),
  };
}

/** TipTap table — @tiptap/extension-table node shape (table > tableRow > tableHeader|tableCell). */
function table(headers: string[], rows: string[][]): TipTapNode {
  return {
    type: "table",
    content: [tableRow(headers, true), ...rows.map((row) => tableRow(row))],
  };
}

function withEssentials(
  extra: TemplateSchemaFieldSeed[] = [],
): TemplateSchemaFieldSeed[] {
  const seen = new Set(ESSENTIAL_SCHEMA_FIELDS.map((f) => f.field_key));
  return [
    ...ESSENTIAL_SCHEMA_FIELDS,
    ...extra.filter((field) => !seen.has(field.field_key)),
  ];
}

export const SYSTEM_TEMPLATE_SEEDS: readonly SystemTemplateSeed[] = [
  {
    slug: "blank",
    name: "Blank",
    description: "Start from an empty page",
    structure_json: doc(paragraph()),
    metadata: {
      document_type: "note",
      use_cases: ["Quick notes", "Freeform drafts", "Anything unstructured"],
      supported_views: ["wiki", "kanban", "calendar", "gantt", "dashboard"],
      schema_fields: withEssentials(),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "meeting-notes",
    name: "Meeting Notes",
    description: "Objective, agenda, discussion, and action items",
    structure_json: doc(
      heading(2, "Objective"),
      tip("One sentence: the primary goal of this meeting."),
      paragraph(text("[Goal of this meeting]")),
      heading(2, "Agenda"),
      tip("List topics in the order you plan to cover them."),
      bullet(["[Topic 1]", "[Topic 2]"]),
      heading(2, "Discussion & Notes"),
      tip("Capture key points, decisions, and context — not a transcript."),
      bullet([
        "[Key point discussed]",
        "[Decision made regarding X]",
        "[Context or insight shared]",
      ]),
      heading(2, "Action Items"),
      tip("Who owns what, and by when. Keep owners in the body for now."),
      bullet([
        "@Name – [Task description] – Due: [Date]",
        "@Name – [Task description] – Due: [Date]",
      ]),
    ),
    metadata: {
      document_type: "meeting_notes",
      use_cases: ["Team syncs", "Client calls", "Sprint planning", "Decision meetings"],
      supported_views: ["calendar", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "meeting_date",
          field_label: "Meeting date",
          field_type: "date",
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "product-spec",
    name: "Product Spec",
    description: "Problem, hypothesis, scope, UX flow, and success metrics",
    structure_json: doc(
      heading(2, "Problem & Insight"),
      tip("What problem are we solving, and what evidence validates it?"),
      paragraph(
        text(
          "[Describe the core problem and the user insight or data that validates it.]",
        ),
      ),
      heading(2, "Hypothesis"),
      tip("If / then / because — keep it falsifiable."),
      paragraph(
        text("If we "),
        text("[build/change this feature]", true),
        text(", then "),
        text("[this behavior will happen]", true),
        text(", because "),
        text("[underlying reasoning].", true),
      ),
      heading(2, "Goals & Non-Goals"),
      tip("Be explicit about what is out of scope to prevent creep."),
      paragraph(text("In Scope:", true)),
      bullet(["[Key deliverable 1]", "[Key deliverable 2]"]),
      paragraph(text("Out of Scope:", true)),
      bullet(["[What we are NOT building right now]"]),
      heading(2, "User Experience & Flow"),
      tip("Walk through the journey in order."),
      ordered(["[Step 1 of the user journey]", "[Step 2 of the user journey]"]),
      heading(2, "Technical Architecture & Considerations"),
      tip("Data, APIs, and constraints that affect the build."),
      bullet([
        "[Data structure changes, API requirements, or frontend/backend constraints]",
      ]),
      heading(2, "Success Metrics"),
      tip("One primary metric and one guardrail that must not degrade."),
      bullet([
        "Primary Metric: [What determines success?]",
        "Guardrail Metric: [What should not degrade?]",
      ]),
    ),
    metadata: {
      document_type: "product_spec",
      use_cases: ["Feature specs", "Quarterly planning", "PRD drafts", "Experiment design"],
      supported_views: ["kanban", "gantt", "dashboard"],
      schema_fields: withEssentials([
        {
          field_key: "priority",
          field_label: "Priority",
          field_type: "select",
          options: ["p0", "p1", "p2", "p3"],
          ai_fill_enabled: true,
        },
        {
          field_key: "milestone",
          field_label: "Milestone",
          field_type: "text",
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
        priority: "p2",
      },
    },
  },
  {
    slug: "report",
    name: "Report",
    description: "Executive summary, findings, analysis, and next steps",
    structure_json: doc(
      heading(2, "Executive Summary"),
      tip("TL;DR in 2–3 sentences — the single most important takeaway."),
      paragraph(text("[Conclusion and primary takeaway.]")),
      heading(2, "Key Findings & Highlights"),
      tip("Lead with impact, not raw data."),
      bullet([
        "[Finding 1]: [Brief explanation and impact]",
        "[Finding 2]: [Brief explanation and impact]",
      ]),
      heading(2, "Detailed Analysis"),
      tip("Evidence, context, and long-term effects that support the findings."),
      paragraph(
        text(
          "[Deep dive into data, context, or qualitative feedback supporting the findings.]",
        ),
      ),
      heading(2, "Roadblocks & Learnings"),
      tip("What surprised you, and what friction or cost appeared?"),
      bullet([
        "[What didn't go as expected?]",
        "[What frictions or costs were encountered?]",
      ]),
      heading(2, "Next Steps"),
      tip("Concrete follow-ups, not vague intentions."),
      ordered([
        "[Actionable step based on the findings]",
        "[Follow-up item]",
      ]),
    ),
    metadata: {
      document_type: "report",
      use_cases: [
        "Weekly status",
        "Research summaries",
        "Quarterly reviews",
        "Experiment readouts",
      ],
      supported_views: ["dashboard", "calendar", "gantt"],
      schema_fields: withEssentials([
        {
          field_key: "period_end",
          field_label: "Period end",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "confidence",
          field_label: "Confidence",
          field_type: "select",
          options: ["low", "medium", "high"],
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "sop",
    name: "SOP",
    description: "Purpose, scope, procedure, roles, and exceptions",
    structure_json: doc(
      heading(2, "Purpose"),
      tip("Why this procedure exists and what it prevents or ensures."),
      paragraph(text("[The outcome this SOP guarantees when followed.]")),
      heading(2, "Scope"),
      tip("Who and what this applies to — and what it explicitly excludes."),
      bullet(["[Applies to: team, system, or situation]", "[Does not cover: …]"]),
      heading(2, "Procedure"),
      tip("Numbered steps, in the exact order they should be performed."),
      ordered([
        "[Step 1 — action and expected result]",
        "[Step 2 — action and expected result]",
        "[Step 3 — action and expected result]",
      ]),
      heading(2, "Roles & Responsibilities"),
      tip("Who owns each step, and who to contact if it breaks."),
      bullet(["[Role] — [Responsibility]", "[Role] — [Responsibility]"]),
      heading(2, "Exceptions"),
      tip("Known edge cases and what to do when the standard steps don't apply."),
      bullet(["[Situation] — [What to do instead]"]),
    ),
    metadata: {
      document_type: "sop",
      use_cases: [
        "Standard operating procedures",
        "Runbooks",
        "Repeatable processes",
        "Incident playbooks",
      ],
      supported_views: ["wiki", "dashboard"],
      schema_fields: withEssentials(KB_OPS_SCHEMA_FIELDS),
      default_properties: {
        status: "draft",
        verification_status: "needs_review",
      },
    },
  },
  {
    slug: "onboarding-guide",
    name: "Onboarding Guide",
    description: "Welcome, first week, tools & access, and checkpoints",
    structure_json: doc(
      heading(2, "Welcome"),
      tip("Set the tone — what this role owns and why it matters."),
      paragraph(text("[Welcome note and a one-line summary of the role's mission.]")),
      heading(2, "First Week"),
      tip("Day-by-day goals — enough structure to remove first-week anxiety."),
      bullet([
        "Day 1: [Setup, intros, orientation]",
        "Day 2–3: [Shadowing, reading, first small task]",
        "Day 4–5: [First real contribution]",
      ]),
      heading(2, "Tools & Access"),
      tip("Every account, tool, and permission needed — and who grants it."),
      bullet(["[Tool/System] — [Requested from]", "[Tool/System] — [Requested from]"]),
      heading(2, "Checkpoints"),
      tip("30/60/90-day markers so progress is visible to both sides."),
      ordered([
        "30 days: [What success looks like]",
        "60 days: [What success looks like]",
        "90 days: [What success looks like]",
      ]),
    ),
    metadata: {
      document_type: "onboarding_guide",
      use_cases: [
        "New hire onboarding",
        "Role transitions",
        "Team ramp-up",
        "Contractor kickoff",
      ],
      supported_views: ["wiki", "calendar"],
      schema_fields: withEssentials(KB_OPS_SCHEMA_FIELDS),
      default_properties: {
        status: "draft",
        verification_status: "needs_review",
      },
    },
  },
  {
    slug: "policy-document",
    name: "Policy Document",
    description: "Statement, applicability, requirements, enforcement, and review",
    structure_json: doc(
      heading(2, "Policy Statement"),
      tip("One or two sentences stating the rule — no ambiguity."),
      paragraph(text("[The policy, stated plainly.]")),
      heading(2, "Applicability"),
      tip("Who must follow this, and any exclusions."),
      bullet(["[Applies to: team, role, or system]", "[Excludes: …]"]),
      heading(2, "Requirements"),
      tip("Concrete, checkable requirements — not intentions."),
      bullet(["[Requirement 1]", "[Requirement 2]"]),
      heading(2, "Enforcement"),
      tip("What happens when this policy isn't followed."),
      paragraph(text("[Consequences and who is responsible for enforcing them.]")),
      heading(2, "Review"),
      tip("How often this policy is revisited, and by whom."),
      paragraph(text("[Review cadence and owner.]")),
    ),
    metadata: {
      document_type: "policy",
      use_cases: [
        "Company policies",
        "Compliance requirements",
        "Acceptable use",
        "Data handling rules",
      ],
      supported_views: ["wiki", "dashboard"],
      schema_fields: withEssentials(KB_OPS_SCHEMA_FIELDS),
      default_properties: {
        status: "draft",
        verification_status: "needs_review",
      },
    },
  },
  {
    slug: "ab-experiment",
    name: "A/B Experiment",
    description: "Hypothesis, target segment, success metrics, and variations",
    structure_json: doc(
      heading(2, "Hypothesis & Rationale"),
      tip("If we [do X], then [Y] will happen, because [underlying reasoning]."),
      paragraph(
        text("If we "),
        text("[build/change this]", true),
        text(", then "),
        text("[this behavior will happen]", true),
        text(", because "),
        text("[underlying reasoning].", true),
      ),
      heading(2, "Target Audience & Segment"),
      tip("Who this experiment is shown to — be specific enough to segment on."),
      bullet(["[New users]", "[Power users]", "[Churn risk]"]),
      heading(2, "Success Metrics"),
      tip("One primary metric and any secondary metrics, with baseline and target."),
      table(
        ["Metric", "Type", "Baseline", "Target"],
        [
          ["[Conversion rate]", "Primary", "[Current %]", "[Target %]"],
          ["[Guardrail metric]", "Secondary", "[Current value]", "[Must not fall below]"],
        ],
      ),
      heading(2, "Variations & Implementation Notes"),
      tip("What changes in each variant, and anything engineering needs to know."),
      bullet(["[Variant A — control]", "[Variant B — treatment]"]),
    ),
    metadata: {
      document_type: "ab_experiment",
      use_cases: ["A/B tests", "Growth experiments", "Feature rollout validation"],
      supported_views: ["kanban", "dashboard", "gantt"],
      schema_fields: withEssentials([
        {
          field_key: "experiment_status",
          field_label: "Experiment status",
          field_type: "status",
          options: [
            { value: "backlog", label: "Backlog", category: "unstarted" },
            { value: "design", label: "Design", category: "unstarted" },
            { value: "engineering", label: "Engineering", category: "started" },
            { value: "live", label: "Live", category: "started" },
            { value: "analyzing", label: "Analyzing", category: "started" },
            { value: "concluded", label: "Concluded", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "date_active",
          field_label: "Timeline",
          field_type: "date_range",
          ai_fill_enabled: true,
        },
        {
          field_key: "target_sprint",
          field_label: "Target sprint/quarter",
          field_type: "text",
          ai_fill_enabled: false,
        },
        {
          field_key: "funnel_stage",
          field_label: "Funnel stage",
          field_type: "select",
          options: ["acquisition", "activation", "retention", "referral", "revenue"],
          ai_fill_enabled: true,
        },
        {
          field_key: "target_segment",
          field_label: "Target segment",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "impact",
          field_label: "Impact (1-10)",
          field_type: "number",
          ai_fill_enabled: false,
        },
        {
          field_key: "confidence",
          field_label: "Confidence (1-10)",
          field_type: "number",
          ai_fill_enabled: false,
        },
        {
          field_key: "ease",
          field_label: "Ease (1-10)",
          field_type: "number",
          ai_fill_enabled: false,
        },
        {
          field_key: "cost_of_experimentation",
          field_label: "Cost of experimentation",
          field_type: "number",
          options: { unit: "days" },
          ai_fill_enabled: false,
        },
        {
          field_key: "erosion_risk",
          field_label: "Long-term erosion risk",
          field_type: "checkbox",
          ai_fill_enabled: false,
        },
        {
          field_key: "origin",
          field_label: "Origin",
          field_type: "relation",
          ai_fill_enabled: false,
        },
      ]),
      default_properties: {
        status: "draft",
        experiment_status: "backlog",
        funnel_stage: "activation",
      },
    },
  },
  {
    slug: "insight",
    name: "Insight",
    description: "Core insight, evidence, and confidence — feeds the experiment backlog",
    structure_json: doc(
      heading(2, "The Core Insight"),
      tip("State the insight in one or two sentences — what did you learn?"),
      paragraph(text("[The insight, stated plainly.]")),
      heading(2, "User Quotes / Data Evidence"),
      tip("The evidence that backs this up — quotes, numbers, or links to sources."),
      bullet(["[Quote or data point 1]", "[Quote or data point 2]"]),
      heading(2, "Recommended Action"),
      tip("What should happen next — an idea to validate, or an experiment to design."),
      paragraph(text("[Proposed next step.]")),
    ),
    metadata: {
      document_type: "insight",
      use_cases: ["User research findings", "Discovery notes", "Experiment backlog input"],
      supported_views: ["kanban", "wiki"],
      schema_fields: withEssentials(GROWTH_DISCOVERY_SCHEMA_FIELDS),
      default_properties: {
        status: "draft",
        state: "raw",
      },
    },
  },
  {
    slug: "problem",
    name: "Problem",
    description: "Problem statement, impact, and evidence — feeds the experiment backlog",
    structure_json: doc(
      heading(2, "Problem Statement"),
      tip("What's broken or underperforming, for whom, and how do you know?"),
      paragraph(text("[The problem, stated plainly.]")),
      heading(2, "Impact"),
      tip("Who is affected, how often, and what it costs if left unsolved."),
      bullet(["[Who is affected]", "[Frequency / severity]", "[Cost of inaction]"]),
      heading(2, "User Quotes / Data Evidence"),
      tip("The evidence that this is real — quotes, numbers, or links to sources."),
      bullet(["[Quote or data point 1]", "[Quote or data point 2]"]),
    ),
    metadata: {
      document_type: "problem",
      use_cases: ["Problem statements", "Discovery notes", "Experiment backlog input"],
      supported_views: ["kanban", "wiki"],
      schema_fields: withEssentials(GROWTH_DISCOVERY_SCHEMA_FIELDS),
      default_properties: {
        status: "draft",
        state: "raw",
      },
    },
  },
  {
    slug: "scientific-experiment",
    name: "Scientific Experiment",
    description: "Hypothesis, methodology, variables, results, and conclusion",
    structure_json: doc(
      heading(2, "Hypothesis"),
      tip("The falsifiable statement this experiment tests."),
      paragraph(text("[Hypothesis, stated as a testable claim.]")),
      heading(2, "Methodology"),
      tip("How the experiment is run — design, sample, and procedure."),
      paragraph(text("[Experimental design and procedure.]")),
      heading(2, "Variables"),
      tip("What you're changing (independent) and what you're measuring (dependent)."),
      bullet(["Independent: [what you manipulate]", "Dependent: [what you measure]", "Controlled: [what you hold constant]"]),
      heading(2, "Results"),
      tip("What happened — data, observations, and any anomalies."),
      paragraph(text("[Results and observations.]")),
      heading(2, "Conclusion"),
      tip("Was the hypothesis supported? What follows from this?"),
      paragraph(text("[Conclusion and next steps.]")),
    ),
    metadata: {
      document_type: "scientific_experiment",
      use_cases: ["Scientific research", "Lab experiments", "Hypothesis testing"],
      supported_views: ["kanban", "gantt", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "experiment_status",
          field_label: "Experiment status",
          field_type: "status",
          options: [
            { value: "planned", label: "Planned", category: "unstarted" },
            { value: "running", label: "Running", category: "started" },
            { value: "analyzing", label: "Analyzing", category: "started" },
            { value: "concluded", label: "Concluded", category: "completed" },
            { value: "abandoned", label: "Abandoned", category: "canceled" },
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "date_active",
          field_label: "Timeline",
          field_type: "date_range",
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
        experiment_status: "planned",
      },
    },
  },
  {
    slug: "adr",
    name: "Architecture Decision Record",
    description: "Context, decision, alternatives, and consequences of a technical choice",
    structure_json: doc(
      heading(2, "Context & Problem"),
      tip("The technical constraint or requirement that forces a decision."),
      paragraph(text("[Context and problem statement.]")),
      heading(2, "Decision"),
      tip("The decision, stated as a clear, single commitment."),
      paragraph(text("[Decision, stated plainly.]")),
      heading(2, "Considered Alternatives"),
      tip("Every option seriously considered, and why it was or wasn't chosen."),
      table(
        ["Alternative", "Pros", "Cons", "Reason for Rejection"],
        [
          ["[Option A]", "[Pros]", "[Cons]", "[Reason]"],
          ["[Option B]", "[Pros]", "[Cons]", "[Reason]"],
        ],
      ),
      heading(2, "Consequences"),
      tip("What becomes easier or harder as a result — positive and negative."),
      bullet(["[Positive consequence]", "[Negative consequence / trade-off]"]),
    ),
    metadata: {
      document_type: "adr",
      use_cases: ["Architecture decisions", "Technical RFCs", "Engineering design records"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "decision_date",
          field_label: "Decision date",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "decision_status",
          field_label: "Decision status",
          field_type: "status",
          options: [
            { value: "proposed", label: "Proposed", category: "unstarted" },
            { value: "accepted", label: "Accepted", category: "completed" },
            { value: "deprecated", label: "Deprecated", category: "canceled" },
            { value: "superseded", label: "Superseded", category: "canceled" },
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "requires_downtime",
          field_label: "Requires downtime",
          field_type: "checkbox",
          ai_fill_enabled: false,
        },
        ...PRODUCT_ARCHITECTURE_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        decision_status: "proposed",
      },
    },
  },
  {
    slug: "technical-requirements-document",
    name: "Technical Requirements Document",
    description: "Functional and non-functional requirements, dependencies, and risks",
    structure_json: doc(
      heading(2, "Overview & Goals"),
      tip("What this system/feature must accomplish, and why it matters."),
      paragraph(text("[Overview and goals.]")),
      heading(2, "Functional Requirements"),
      tip("What the system must do — one row per discrete, testable requirement."),
      table(
        ["Req ID", "Description", "Priority", "Status"],
        [
          ["REQ-1", "[Requirement description]", "[Must/Should/Could]", "[Not started]"],
          ["REQ-2", "[Requirement description]", "[Must/Should/Could]", "[Not started]"],
        ],
      ),
      heading(2, "Non-Functional Requirements"),
      tip("Performance, security, scalability, and other quality constraints."),
      bullet(["[Performance requirement]", "[Security requirement]", "[Scalability requirement]"]),
      heading(2, "Dependencies & Risks"),
      tip("What this depends on, and what could block or derail it."),
      bullet(["[Dependency]", "[Risk / mitigation]"]),
    ),
    metadata: {
      document_type: "technical_requirements_document",
      use_cases: ["Engineering specs", "System design", "Requirements gathering"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "priority",
          field_label: "Priority",
          field_type: "select",
          options: ["low", "medium", "high", "critical"],
          ai_fill_enabled: true,
        },
        {
          field_key: "target_release",
          field_label: "Target release",
          field_type: "text",
          ai_fill_enabled: false,
        },
        ...PRODUCT_ARCHITECTURE_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        priority: "medium",
      },
    },
  },
  {
    slug: "workflow-definition",
    name: "Workflow Definition",
    description: "A repeatable process — trigger, steps, roles, and exceptions",
    structure_json: doc(
      heading(2, "Trigger"),
      tip("What starts this workflow — an event, request, or schedule."),
      paragraph(text("[What kicks this off.]")),
      heading(2, "Steps"),
      tip("The ordered steps from trigger to completion."),
      ordered(["[Step 1]", "[Step 2]", "[Step 3]"]),
      heading(2, "Roles & Handoffs"),
      tip("Who owns each step, and where work changes hands."),
      bullet(["[Role] — [Responsibility]", "[Role] — [Responsibility]"]),
      heading(2, "Exceptions"),
      tip("What happens when a step fails or a special case arises."),
      bullet(["[Exception case] — [How it's handled]"]),
    ),
    metadata: {
      document_type: "workflow_definition",
      use_cases: ["Process documentation", "Operational runbooks", "Cross-team handoffs"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "workflow_status",
          field_label: "Workflow status",
          field_type: "status",
          options: [
            { value: "draft", label: "Draft", category: "unstarted" },
            { value: "active", label: "Active", category: "started" },
            { value: "deprecated", label: "Deprecated", category: "canceled" },
          ],
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
        workflow_status: "draft",
      },
    },
  },
  {
    slug: "prd",
    name: "Product Requirements Document",
    description: "Problem, scope, requirements, and what's explicitly out",
    structure_json: doc(
      heading(2, "Problem Statement & Insight"),
      tip("The problem this feature solves, and the evidence behind it."),
      paragraph(text("[Problem statement and supporting insight.]")),
      heading(2, "User Stories / How Might We"),
      tip("Frame the opportunity from the user's perspective."),
      bullet(["[As a ... I want to ... so that ...]", "[How might we ...?]"]),
      heading(2, "Scope & Requirements"),
      tip("Every requirement, prioritized with MoSCoW and an effort estimate."),
      table(
        ["Req ID", "Description", "MoSCoW", "Effort", "Status"],
        [
          ["REQ-1", "[Requirement description]", "Must", "[S/M/L]", "[Not started]"],
          ["REQ-2", "[Requirement description]", "Should", "[S/M/L]", "[Not started]"],
        ],
      ),
      heading(2, "Out of Scope"),
      tip("What this explicitly does not cover — prevents scope creep."),
      bullet(["[Out of scope item]"]),
    ),
    metadata: {
      document_type: "prd",
      use_cases: ["Product requirements", "Feature specs", "Cross-functional alignment"],
      supported_views: ["wiki", "kanban", "gantt"],
      schema_fields: withEssentials([
        {
          field_key: "priority",
          field_label: "Priority",
          field_type: "select",
          options: ["low", "medium", "high", "critical"],
          ai_fill_enabled: true,
        },
        {
          field_key: "strategic_alignment",
          field_label: "Strategic alignment",
          field_type: "select",
          options: ["user_growth", "retention", "tech_debt", "compliance"],
          ai_fill_enabled: true,
        },
        ...PRODUCT_DISCOVERY_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        priority: "medium",
      },
    },
  },
  {
    slug: "product-feature",
    name: "Product Feature",
    description: "Problem, proposed solution, acceptance criteria, and success metrics",
    structure_json: doc(
      heading(2, "Problem & Opportunity"),
      tip("What's the gap or opportunity this feature addresses?"),
      paragraph(text("[Problem and opportunity.]")),
      heading(2, "Proposed Solution"),
      tip("What you're building, at a level a non-engineer can follow."),
      paragraph(text("[Proposed solution.]")),
      heading(2, "Acceptance Criteria"),
      tip("The testable conditions that define 'done'."),
      bullet(["[Given ... when ... then ...]", "[Given ... when ... then ...]"]),
      heading(2, "Success Metrics"),
      tip("How you'll know this feature worked after shipping."),
      bullet(["[Metric and target]"]),
    ),
    metadata: {
      document_type: "product_feature",
      use_cases: ["Feature specs", "Backlog items", "Sprint planning"],
      supported_views: ["kanban", "wiki", "gantt"],
      schema_fields: withEssentials([
        {
          field_key: "feature_status",
          field_label: "Feature status",
          field_type: "status",
          options: [
            { value: "idea", label: "Idea", category: "unstarted" },
            { value: "planned", label: "Planned", category: "unstarted" },
            { value: "building", label: "Building", category: "started" },
            { value: "shipped", label: "Shipped", category: "completed" },
            { value: "deprecated", label: "Deprecated", category: "canceled" },
          ],
          ai_fill_enabled: true,
        },
        ...PRODUCT_DISCOVERY_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        feature_status: "idea",
      },
    },
  },
  {
    slug: "user-flow-definition",
    name: "User Flow Definition",
    description: "Goal, steps, edge cases, and success state for a user journey",
    structure_json: doc(
      heading(2, "Goal & Entry Point"),
      tip("What the user is trying to accomplish, and where the flow begins."),
      paragraph(text("[Goal and entry point.]")),
      heading(2, "Steps"),
      tip("The ordered steps a user takes from entry to completion."),
      ordered(["[Step 1]", "[Step 2]", "[Step 3]"]),
      heading(2, "Edge Cases & Error States"),
      tip("What can go wrong, and what the user sees when it does."),
      bullet(["[Edge case] — [What happens]"]),
      heading(2, "Success State"),
      tip("What the user sees and can do once the flow completes."),
      paragraph(text("[Success state.]")),
    ),
    metadata: {
      document_type: "user_flow_definition",
      use_cases: ["UX flows", "Interaction design", "Feature handoff to engineering"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "flow_status",
          field_label: "Flow status",
          field_type: "status",
          options: [
            { value: "draft", label: "Draft", category: "unstarted" },
            { value: "in_review", label: "In review", category: "started" },
            { value: "approved", label: "Approved", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        ...PRODUCT_DISCOVERY_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        flow_status: "draft",
      },
    },
  },
  {
    slug: "swot-analysis",
    name: "SWOT Analysis",
    description: "Strengths, weaknesses, opportunities, and threats for a product or strategy",
    structure_json: doc(
      heading(2, "Strengths"),
      tip("Internal advantages you can build on."),
      bullet(["[Strength]"]),
      heading(2, "Weaknesses"),
      tip("Internal gaps or limitations to address."),
      bullet(["[Weakness]"]),
      heading(2, "Opportunities"),
      tip("External factors you could capitalize on."),
      bullet(["[Opportunity]"]),
      heading(2, "Threats"),
      tip("External factors that could work against you."),
      bullet(["[Threat]"]),
    ),
    metadata: {
      document_type: "swot_analysis",
      use_cases: ["Strategic planning", "Competitive analysis", "Business reviews"],
      supported_views: ["wiki"],
      schema_fields: withEssentials([
        {
          field_key: "analysis_scope",
          field_label: "Analysis scope",
          field_type: "text",
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "project-charter",
    name: "Project Charter",
    description: "Objective, scope, stakeholders, milestones, and success criteria",
    structure_json: doc(
      heading(2, "Objective & Business Case"),
      tip("Why this project exists, and the value it delivers."),
      paragraph(text("[Objective and business case.]")),
      heading(2, "Scope"),
      tip("What's in scope, and — just as important — what's explicitly out."),
      bullet(["In scope: [item]", "Out of scope: [item]"]),
      heading(2, "Stakeholders & Roles"),
      tip("Who's involved, and what they're responsible for."),
      bullet(["[Name/Role] — [Responsibility]"]),
      heading(2, "Milestones"),
      tip("The key checkpoints from kickoff to completion."),
      table(
        ["Milestone", "Target Date", "Owner"],
        [["[Milestone]", "[Date]", "[Owner]"]],
      ),
      heading(2, "Success Criteria"),
      tip("How you'll know this project succeeded."),
      bullet(["[Success criterion]"]),
    ),
    metadata: {
      document_type: "project_charter",
      use_cases: ["Project kickoff", "Cross-functional initiatives", "Stakeholder alignment"],
      supported_views: ["wiki", "gantt", "kanban"],
      schema_fields: withEssentials(GTM_PROJECT_SCHEMA_FIELDS),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "gtm-plan",
    name: "GTM Plan",
    description: "Positioning, audience, channels, and success metrics for a launch",
    structure_json: doc(
      heading(2, "Positioning & Messaging"),
      tip("How this is positioned, and the core message across channels."),
      paragraph(text("[Positioning and key message.]")),
      heading(2, "Target Audience & Segments"),
      tip("Who this launch is for, segmented enough to tailor messaging."),
      bullet(["[Segment 1]", "[Segment 2]"]),
      heading(2, "Channels & Tactics"),
      tip("Where and how you'll reach each segment."),
      table(
        ["Channel", "Tactic", "Owner", "Budget"],
        [["[Channel]", "[Tactic]", "[Owner]", "[Budget]"]],
      ),
      heading(2, "Success Metrics & KPIs"),
      tip("How you'll measure whether the launch worked."),
      bullet(["[Metric and target]"]),
    ),
    metadata: {
      document_type: "gtm_plan",
      use_cases: ["Product launches", "Campaign planning", "Market entry"],
      supported_views: ["wiki", "kanban", "gantt", "dashboard"],
      schema_fields: withEssentials([
        {
          field_key: "gtm_status",
          field_label: "GTM status",
          field_type: "status",
          options: [
            { value: "draft", label: "Draft", category: "unstarted" },
            { value: "approved", label: "Approved", category: "unstarted" },
            { value: "executing", label: "Executing", category: "started" },
            { value: "complete", label: "Complete", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "target_launch_date",
          field_label: "Target launch date",
          field_type: "date",
          ai_fill_enabled: true,
        },
        ...GTM_PROJECT_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        gtm_status: "draft",
      },
    },
  },
  {
    slug: "launch-checklist",
    name: "Launch Checklist",
    description: "Readiness tasks, go/no-go criteria, and rollback plan",
    structure_json: doc(
      heading(2, "Checklist"),
      tip("Every task required to launch, with an owner and current status."),
      table(
        ["Task", "Owner", "Status", "Notes"],
        [
          ["[Engineering readiness]", "[Owner]", "[Not started]", "[Notes]"],
          ["[Marketing readiness]", "[Owner]", "[Not started]", "[Notes]"],
          ["[Support readiness]", "[Owner]", "[Not started]", "[Notes]"],
        ],
      ),
      heading(2, "Go / No-Go Criteria"),
      tip("The conditions that must be true to launch."),
      bullet(["[Criterion]"]),
      heading(2, "Rollback Plan"),
      tip("What happens if something goes wrong after launch."),
      paragraph(text("[Rollback plan.]")),
    ),
    metadata: {
      document_type: "launch_checklist",
      use_cases: ["Product launches", "Feature rollouts", "Release management"],
      supported_views: ["kanban", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "launch_date",
          field_label: "Launch date",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "launch_status",
          field_label: "Launch status",
          field_type: "status",
          options: [
            { value: "planning", label: "Planning", category: "unstarted" },
            { value: "ready", label: "Ready", category: "started" },
            { value: "launched", label: "Launched", category: "completed" },
            { value: "rolled_back", label: "Rolled back", category: "canceled" },
          ],
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
        launch_status: "planning",
      },
    },
  },
  {
    slug: "weekly-status",
    name: "Status Report",
    description: "Summary, key metrics, wins, risks, and next steps for a reporting period",
    structure_json: doc(
      heading(2, "Summary"),
      tip("A short, scannable summary of where things stand."),
      paragraph(text("[Summary.]")),
      heading(2, "Key Metrics"),
      tip("The numbers that matter this period, with trend if useful."),
      table(
        ["Metric", "This Period", "Trend"],
        [["[Metric]", "[Value]", "[↑/↓/→]"]],
      ),
      heading(2, "Wins"),
      tip("What went well since the last report."),
      bullet(["[Win]"]),
      heading(2, "Risks & Blockers"),
      tip("What's at risk, and what's blocking progress."),
      bullet(["[Risk or blocker]"]),
      heading(2, "Next Steps"),
      tip("What happens between now and the next report."),
      bullet(["[Next step]"]),
    ),
    metadata: {
      document_type: "weekly_status",
      use_cases: ["Status updates", "Stakeholder reporting", "Project health checks"],
      supported_views: ["dashboard", "calendar", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "report_period",
          field_label: "Report period",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "health",
          field_label: "Health",
          field_type: "status",
          options: [
            { value: "on_track", label: "On track", category: "started" },
            { value: "at_risk", label: "At risk", category: "started" },
            { value: "off_track", label: "Off track", category: "started" },
          ],
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
        health: "on_track",
      },
    },
  },
  {
    slug: "campaign-brief",
    name: "Campaign Brief",
    description: "Objective, audience, channels, timeline, and success metrics for a campaign",
    structure_json: doc(
      heading(2, "Objective & Audience"),
      tip("What this campaign is trying to achieve, and for whom."),
      paragraph(text("[Objective and target audience.]")),
      heading(2, "Key Message"),
      tip("The single message every asset should reinforce."),
      paragraph(text("[Key message.]")),
      heading(2, "Channels & Timeline"),
      tip("Where this runs, and when each phase happens."),
      table(
        ["Channel", "Phase", "Timing", "Owner"],
        [["[Channel]", "[Phase]", "[Dates]", "[Owner]"]],
      ),
      heading(2, "Success Metrics"),
      tip("How you'll know the campaign worked."),
      bullet(["[Metric and target]"]),
    ),
    metadata: {
      document_type: "campaign_brief",
      use_cases: ["Marketing campaigns", "Product launches", "Brand initiatives"],
      supported_views: ["wiki", "kanban", "gantt", "dashboard"],
      schema_fields: withEssentials([
        {
          field_key: "campaign_status",
          field_label: "Campaign status",
          field_type: "status",
          options: [
            { value: "planning", label: "Planning", category: "unstarted" },
            { value: "live", label: "Live", category: "started" },
            { value: "complete", label: "Complete", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "channel",
          field_label: "Channel",
          field_type: "multi_select",
          options: ["email", "social", "paid", "organic", "pr"],
          ai_fill_enabled: true,
        },
        {
          field_key: "budget",
          field_label: "Budget",
          field_type: "number",
          ai_fill_enabled: false,
        },
      ]),
      default_properties: {
        status: "draft",
        campaign_status: "planning",
      },
    },
  },
  {
    slug: "editorial-calendar",
    name: "Content Calendar Item",
    description: "Brief, outline, SEO keywords, and distribution for a single piece of content",
    structure_json: doc(
      heading(2, "Brief & Angle"),
      tip("What this piece is about, and the unique angle it takes."),
      paragraph(text("[Brief and angle.]")),
      heading(2, "Outline"),
      tip("The structure this piece will follow."),
      ordered(["[Section 1]", "[Section 2]", "[Section 3]"]),
      heading(2, "SEO Keywords"),
      tip("Primary and secondary keywords this piece should rank for."),
      bullet(["[Primary keyword]", "[Secondary keyword]"]),
      heading(2, "Distribution Channels"),
      tip("Where this gets published and promoted."),
      bullet(["[Channel]"]),
    ),
    metadata: {
      document_type: "editorial_calendar",
      use_cases: ["Blog posts", "Newsletters", "Video/podcast planning"],
      supported_views: ["calendar", "kanban", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "publish_date",
          field_label: "Publish date",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "content_status",
          field_label: "Content status",
          field_type: "status",
          options: [
            { value: "idea", label: "Idea", category: "unstarted" },
            { value: "drafting", label: "Drafting", category: "started" },
            { value: "review", label: "Review", category: "started" },
            { value: "scheduled", label: "Scheduled", category: "started" },
            { value: "published", label: "Published", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "content_type",
          field_label: "Content type",
          field_type: "select",
          options: ["blog", "video", "social", "newsletter", "podcast"],
          ai_fill_enabled: true,
        },
        ...CONTENT_MARKETING_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        content_status: "idea",
      },
    },
  },
  {
    slug: "seo-brief",
    name: "SEO Brief",
    description: "Target keyword, search intent, competing pages, and content outline",
    structure_json: doc(
      heading(2, "Target Keyword & Search Intent"),
      tip("The keyword this page targets, and what the searcher actually wants."),
      paragraph(text("[Target keyword and search intent.]")),
      heading(2, "Competing Pages"),
      tip("What's currently ranking, and what it does well or poorly."),
      table(
        ["URL", "Word Count", "Notes"],
        [["[Competing URL]", "[Word count]", "[Notes]"]],
      ),
      heading(2, "Content Outline"),
      tip("The heading structure that will satisfy search intent."),
      ordered(["[H2 section]", "[H2 section]", "[H2 section]"]),
      heading(2, "Internal Linking Plan"),
      tip("Which existing pages should link to this, and vice versa."),
      bullet(["[Page to link from/to]"]),
    ),
    metadata: {
      document_type: "seo_brief",
      use_cases: ["SEO content", "Page optimization", "Content strategy"],
      supported_views: ["kanban", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "target_keyword",
          field_label: "Target keyword",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "search_intent",
          field_label: "Search intent",
          field_type: "select",
          options: ["informational", "navigational", "transactional", "commercial"],
          ai_fill_enabled: true,
        },
        {
          field_key: "seo_status",
          field_label: "SEO status",
          field_type: "status",
          options: [
            { value: "research", label: "Research", category: "unstarted" },
            { value: "drafting", label: "Drafting", category: "started" },
            { value: "optimizing", label: "Optimizing", category: "started" },
            { value: "published", label: "Published", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        ...CONTENT_MARKETING_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        seo_status: "research",
      },
    },
  },
  {
    slug: "social-post-batch",
    name: "Social Post Batch",
    description: "A batch of scheduled posts across platforms, with copy and performance notes",
    structure_json: doc(
      heading(2, "Posts"),
      tip("Every post in this batch, with copy, platform, and schedule."),
      table(
        ["Post", "Platform", "Copy", "Scheduled Date", "Status"],
        [["[Post 1]", "[Platform]", "[Copy]", "[Date]", "[Not started]"]],
      ),
      heading(2, "Hashtags & Mentions"),
      tip("Reusable hashtags and accounts to tag across this batch."),
      bullet(["[#hashtag]", "[@mention]"]),
      heading(2, "Performance Notes"),
      tip("What worked, what didn't — feed this into the next batch."),
      paragraph(text("[Performance notes.]")),
    ),
    metadata: {
      document_type: "social_post_batch",
      use_cases: ["Social media scheduling", "Campaign amplification", "Community management"],
      supported_views: ["calendar", "kanban", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "platform",
          field_label: "Platform",
          field_type: "multi_select",
          options: ["instagram", "tiktok", "x", "linkedin", "facebook", "youtube"],
          ai_fill_enabled: true,
        },
        {
          field_key: "batch_status",
          field_label: "Batch status",
          field_type: "status",
          options: [
            { value: "planning", label: "Planning", category: "unstarted" },
            { value: "drafting", label: "Drafting", category: "started" },
            { value: "scheduled", label: "Scheduled", category: "started" },
            { value: "posted", label: "Posted", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        ...CONTENT_MARKETING_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        batch_status: "planning",
      },
    },
  },
  {
    slug: "digital-maturity-audit",
    name: "Digital Maturity Audit",
    description: "Score maturity dimensions, surface findings, and recommend a roadmap",
    structure_json: doc(
      heading(2, "Scope & Methodology"),
      tip("What was assessed, and how — interviews, tooling review, data analysis, etc."),
      paragraph(text("[Scope and methodology.]")),
      heading(2, "Maturity Dimensions"),
      tip("Score each dimension against a target — this becomes the roadmap's backbone."),
      table(
        ["Dimension", "Current Score", "Target Score", "Notes"],
        [
          ["Strategy", "[1-5]", "[1-5]", "[Notes]"],
          ["Technology", "[1-5]", "[1-5]", "[Notes]"],
          ["Data", "[1-5]", "[1-5]", "[Notes]"],
          ["Culture", "[1-5]", "[1-5]", "[Notes]"],
          ["Process", "[1-5]", "[1-5]", "[Notes]"],
        ],
      ),
      heading(2, "Key Findings"),
      tip("The most important patterns across dimensions — 3-5 findings, not thirty."),
      bullet(["[Finding]"]),
      heading(2, "Recommendations & Roadmap"),
      tip("Prioritized recommendations, sequenced into a roadmap."),
      bullet(["[Recommendation]"]),
    ),
    metadata: {
      document_type: "digital_maturity_audit",
      use_cases: ["Digital transformation", "Consulting engagements", "Technology assessments"],
      supported_views: ["wiki", "dashboard"],
      schema_fields: withEssentials([
        AUDIT_STATUS_FIELD,
        {
          field_key: "maturity_score",
          field_label: "Overall maturity score",
          field_type: "number",
          ai_fill_enabled: false,
        },
        ...STRATEGY_CONSULTING_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        audit_status: "scoping",
      },
    },
  },
  {
    slug: "general-audit",
    name: "General Audit",
    description: "Scope, findings by risk level, executive summary, and action plan",
    structure_json: doc(
      heading(2, "Scope & Objectives"),
      tip("What's being audited, and what the audit needs to answer."),
      paragraph(text("[Scope and objectives.]")),
      heading(2, "Findings"),
      tip("Every finding, rated by risk level, with a concrete recommendation."),
      table(
        ["Area", "Observation", "Risk Level", "Recommendation"],
        [["[Area]", "[Observation]", "[Low/Medium/High/Critical]", "[Recommendation]"]],
      ),
      heading(2, "Executive Summary"),
      tip("The two-minute version for people who won't read the findings table."),
      paragraph(text("[Executive summary.]")),
      heading(2, "Action Plan"),
      tip("What happens next, who owns it, and by when."),
      bullet(["[Action] — [Owner] — [Due date]"]),
    ),
    metadata: {
      document_type: "general_audit",
      use_cases: ["Financial audits", "Operational reviews", "Compliance and security audits"],
      supported_views: ["wiki", "dashboard"],
      schema_fields: withEssentials([
        AUDIT_STATUS_FIELD,
        {
          field_key: "audit_type",
          field_label: "Audit type",
          field_type: "select",
          options: ["financial", "operational", "compliance", "security", "quality"],
          ai_fill_enabled: true,
        },
        ...STRATEGY_CONSULTING_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        audit_status: "scoping",
      },
    },
  },
  {
    slug: "business-plan",
    name: "Business Plan",
    description: "Executive summary, market analysis, business model, and financial projections",
    structure_json: doc(
      heading(2, "Executive Summary"),
      tip("The whole plan in a paragraph — what, why, and why now."),
      paragraph(text("[Executive summary.]")),
      heading(2, "Market Analysis"),
      tip("The market size, target customer, and competitive landscape."),
      paragraph(text("[Market analysis.]")),
      heading(2, "Business Model"),
      tip("How this makes money — pricing, channels, and unit economics."),
      paragraph(text("[Business model.]")),
      heading(2, "Financial Projections"),
      tip("Revenue, costs, and profit over the planning horizon."),
      table(
        ["Year", "Revenue", "Costs", "Profit"],
        [
          ["Year 1", "[Revenue]", "[Costs]", "[Profit]"],
          ["Year 2", "[Revenue]", "[Costs]", "[Profit]"],
          ["Year 3", "[Revenue]", "[Costs]", "[Profit]"],
        ],
      ),
      heading(2, "Team & Operations"),
      tip("Who's running this, and how it actually operates day to day."),
      bullet(["[Team member/role]"]),
      heading(2, "Funding Ask"),
      tip("What you're raising, and what it buys."),
      paragraph(text("[Funding ask.]")),
    ),
    metadata: {
      document_type: "business_plan",
      use_cases: ["Startup planning", "Fundraising", "Strategic planning"],
      supported_views: ["wiki", "dashboard"],
      schema_fields: withEssentials([
        {
          field_key: "stage",
          field_label: "Stage",
          field_type: "select",
          options: ["idea", "pre_seed", "seed", "series_a", "growth"],
          ai_fill_enabled: true,
        },
        {
          field_key: "industry",
          field_label: "Industry",
          field_type: "text",
          ai_fill_enabled: true,
        },
        ...STRATEGY_CONSULTING_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        stage: "idea",
      },
    },
  },
  {
    slug: "professional-business-letter",
    name: "Professional Business Letter",
    description: "Salutation, body, and closing for a formal business letter",
    structure_json: doc(
      heading(2, "Salutation & Opening"),
      tip("Who you're addressing, and the reason for writing, stated up front."),
      paragraph(text("[Dear ..., I am writing to ...]")),
      heading(2, "Body"),
      tip("The substance of the letter — context, details, and any requests."),
      paragraph(text("[Body of the letter.]")),
      heading(2, "Closing & Signature"),
      tip("A clear next step or call to action, followed by a formal sign-off."),
      paragraph(text("[Sincerely, / Best regards,]")),
    ),
    metadata: {
      document_type: "professional_business_letter",
      use_cases: ["Cover letters", "Client proposals", "Formal notices and references"],
      supported_views: ["wiki"],
      schema_fields: withEssentials([
        {
          field_key: "letter_type",
          field_label: "Letter type",
          field_type: "select",
          options: ["cover_letter", "reference", "proposal", "complaint", "notice"],
          ai_fill_enabled: true,
        },
        {
          field_key: "recipient",
          field_label: "Recipient",
          field_type: "text",
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "one-on-one-notes",
    name: "1:1 Notes",
    description: "Check-in, topics discussed, action items, and notes for next time",
    structure_json: doc(
      heading(2, "Check-in & General Well-being"),
      tip("How things are going, beyond the task list — start here, not with status."),
      paragraph(text("[Check-in notes.]")),
      heading(2, "Topics Discussed"),
      tip("Whatever came up — career, blockers, feedback, or anything else."),
      bullet(["[Topic]"]),
      heading(2, "Action Items"),
      tip("Concrete follow-ups from this conversation, with an owner and due date."),
      table(
        ["Task", "Owner", "Due Date", "Status"],
        [["[Task]", "[Owner]", "[Date]", "[Not started]"]],
      ),
      heading(2, "Notes for Next Meeting"),
      tip("What to pick back up next time."),
      paragraph(text("[Notes for next meeting.]")),
    ),
    metadata: {
      document_type: "one_on_one_notes",
      use_cases: ["Manager 1:1s", "Skip-levels", "Mentor check-ins"],
      supported_views: ["calendar", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "meeting_date",
          field_label: "Meeting date",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "participant",
          field_label: "Participant",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "manager",
          field_label: "Manager",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "requires_hr_followup",
          field_label: "Requires HR follow-up",
          field_type: "checkbox",
          ai_fill_enabled: false,
        },
      ]),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "personal-development-plan",
    name: "Personal Development Plan",
    description: "Career goals, skill development areas, and a check-in schedule",
    structure_json: doc(
      heading(2, "Career Goals"),
      tip("Where this person wants to grow, in their own words."),
      paragraph(text("[Career goals.]")),
      heading(2, "Development Areas"),
      tip("The specific skills or competencies to build, with a concrete action per area."),
      table(
        ["Skill / Competency", "Current Level", "Target Level", "Action"],
        [["[Skill]", "[Current]", "[Target]", "[Action]"]],
      ),
      heading(2, "Support Needed"),
      tip("What has to be true — budget, mentorship, time — for this plan to work."),
      bullet(["[Support needed]"]),
      heading(2, "Check-in Schedule"),
      tip("When you'll revisit this plan together."),
      paragraph(text("[Check-in cadence.]")),
    ),
    metadata: {
      document_type: "personal_development_plan",
      use_cases: ["Career development", "Performance coaching", "Skill growth planning"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "pdp_status",
          field_label: "Plan status",
          field_type: "status",
          options: [
            { value: "draft", label: "Draft", category: "unstarted" },
            { value: "active", label: "Active", category: "started" },
            { value: "completed", label: "Completed", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        ...PEOPLE_OPS_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        pdp_status: "draft",
      },
    },
  },
  {
    slug: "job-description",
    name: "Job Description",
    description: "Role summary, responsibilities, requirements, and compensation",
    structure_json: doc(
      heading(2, "Role Summary"),
      tip("What this role owns, and why it exists, in two or three sentences."),
      paragraph(text("[Role summary.]")),
      heading(2, "Responsibilities"),
      tip("What this person will actually do, day to day."),
      bullet(["[Responsibility]"]),
      heading(2, "Requirements"),
      tip("The must-haves — keep this list short and genuinely required."),
      bullet(["[Requirement]"]),
      heading(2, "Nice to Have"),
      tip("Not required, but a plus."),
      bullet(["[Nice to have]"]),
      heading(2, "Compensation & Benefits"),
      tip("Salary range and key benefits, where you can share them."),
      paragraph(text("[Compensation and benefits.]")),
    ),
    metadata: {
      document_type: "job_description",
      use_cases: ["Hiring", "Role definition", "Org design"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "department",
          field_label: "Department",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "seniority",
          field_label: "Seniority",
          field_type: "select",
          options: ["junior", "mid", "senior", "lead", "principal"],
          ai_fill_enabled: true,
        },
        {
          field_key: "employment_type",
          field_label: "Employment type",
          field_type: "select",
          options: ["full_time", "part_time", "contract", "intern"],
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "performance-review",
    name: "Performance Review",
    description: "Summary, goals and achievements, strengths, growth areas, and next-period goals",
    structure_json: doc(
      heading(2, "Summary"),
      tip("The overall takeaway — lead with this, not the details."),
      paragraph(text("[Summary.]")),
      heading(2, "Goals & Achievements"),
      tip("What was agreed on this period, and how it went."),
      table(
        ["Goal", "Result", "Rating"],
        [["[Goal]", "[Result]", "[Exceeds/Meets/Below]"]],
      ),
      heading(2, "Strengths"),
      tip("What's working well — be specific, not generic."),
      bullet(["[Strength]"]),
      heading(2, "Areas for Growth"),
      tip("What would make the next period even better."),
      bullet(["[Area for growth]"]),
      heading(2, "Next Period Goals"),
      tip("What's agreed for the upcoming period."),
      bullet(["[Goal]"]),
    ),
    metadata: {
      document_type: "performance_review",
      use_cases: ["Performance cycles", "Promotion cases", "Manager feedback"],
      supported_views: ["wiki", "kanban", "calendar"],
      schema_fields: withEssentials([
        {
          field_key: "review_status",
          field_label: "Review status",
          field_type: "status",
          options: [
            { value: "self_review", label: "Self review", category: "started" },
            { value: "manager_review", label: "Manager review", category: "started" },
            { value: "calibration", label: "Calibration", category: "started" },
            { value: "finalized", label: "Finalized", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "rating",
          field_label: "Overall rating",
          field_type: "select",
          options: ["exceeds", "meets", "below", "unsatisfactory"],
          ai_fill_enabled: false,
        },
        ...PEOPLE_OPS_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        review_status: "self_review",
      },
    },
  },
  {
    slug: "legal-document",
    name: "Legal Document",
    description: "Parties, terms, obligations, and signatures for a formal legal document",
    structure_json: doc(
      heading(2, "Parties"),
      tip("Who is bound by this document, with full legal names."),
      bullet(["[Party A]", "[Party B]"]),
      heading(2, "Terms & Conditions"),
      tip("The substantive terms both parties are agreeing to."),
      paragraph(text("[Terms and conditions.]")),
      heading(2, "Obligations"),
      tip("What each party is responsible for delivering or doing."),
      bullet(["[Party A obligation]", "[Party B obligation]"]),
      heading(2, "Signatures"),
      tip("Signature blocks for each party, with date."),
      paragraph(text("[Signature blocks.]")),
    ),
    metadata: {
      document_type: "legal_document",
      use_cases: ["Agreements", "NDAs", "Formal legal correspondence"],
      supported_views: ["wiki"],
      schema_fields: withEssentials([
        {
          field_key: "effective_date",
          field_label: "Effective date",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "legal_status",
          field_label: "Legal status",
          field_type: "status",
          options: [
            { value: "draft", label: "Draft", category: "unstarted" },
            { value: "under_review", label: "Under review", category: "started" },
            { value: "executed", label: "Executed", category: "completed" },
            { value: "expired", label: "Expired", category: "canceled" },
          ],
          ai_fill_enabled: true,
        },
        ...LEGAL_FINANCE_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        legal_status: "draft",
      },
    },
  },
  {
    slug: "contract-review",
    name: "Contract Review",
    description: "Contract summary, key terms, risks, and a review recommendation",
    structure_json: doc(
      heading(2, "Contract Summary"),
      tip("What this contract is for, and who the counterparty is."),
      paragraph(text("[Contract summary.]")),
      heading(2, "Key Terms"),
      tip("The terms that matter most, with a clause reference for each."),
      table(
        ["Term", "Clause Reference", "Notes"],
        [["[Term]", "[Clause]", "[Notes]"]],
      ),
      heading(2, "Risks & Redlines"),
      tip("What's risky as written, and what you'd want changed."),
      bullet(["[Risk or redline]"]),
      heading(2, "Recommendation"),
      tip("Approve, negotiate, or reject — and why."),
      paragraph(text("[Recommendation.]")),
    ),
    metadata: {
      document_type: "contract_review",
      use_cases: ["Vendor contracts", "Customer agreements", "Legal review workflows"],
      supported_views: ["kanban", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "counterparty",
          field_label: "Counterparty",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "contract_value",
          field_label: "Contract value",
          field_type: "number",
          ai_fill_enabled: false,
        },
        {
          field_key: "renewal_date",
          field_label: "Renewal date",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "review_status",
          field_label: "Review status",
          field_type: "status",
          options: [
            { value: "intake", label: "Intake", category: "unstarted" },
            { value: "legal_review", label: "Legal review", category: "started" },
            { value: "negotiation", label: "Negotiation", category: "started" },
            { value: "approved", label: "Approved", category: "completed" },
            { value: "rejected", label: "Rejected", category: "canceled" },
          ],
          ai_fill_enabled: true,
        },
        ...LEGAL_FINANCE_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        review_status: "intake",
      },
    },
  },
  {
    slug: "compliance-checklist",
    name: "Compliance Checklist",
    description: "Requirements, evidence, and a remediation plan for a compliance framework",
    structure_json: doc(
      heading(2, "Requirements"),
      tip("Every requirement under this framework, with an owner and evidence."),
      table(
        ["Requirement", "Owner", "Evidence", "Status"],
        [["[Requirement]", "[Owner]", "[Evidence]", "[Not started]"]],
      ),
      heading(2, "Gaps & Remediation Plan"),
      tip("Where you're not yet compliant, and the plan to close the gap."),
      bullet(["[Gap] — [Remediation plan]"]),
      heading(2, "Next Audit Date"),
      tip("When this needs to be reassessed."),
      paragraph(text("[Next audit date.]")),
    ),
    metadata: {
      document_type: "compliance_checklist",
      use_cases: ["Regulatory compliance", "Security certifications", "Internal audits"],
      supported_views: ["kanban", "wiki", "dashboard"],
      schema_fields: withEssentials([
        {
          field_key: "framework",
          field_label: "Framework",
          field_type: "select",
          options: ["gdpr", "soc2", "hipaa", "iso27001", "pci_dss", "other"],
          ai_fill_enabled: true,
        },
        {
          field_key: "compliance_status",
          field_label: "Compliance status",
          field_type: "status",
          options: [
            { value: "not_started", label: "Not started", category: "unstarted" },
            { value: "in_progress", label: "In progress", category: "started" },
            { value: "compliant", label: "Compliant", category: "completed" },
            { value: "non_compliant", label: "Non-compliant", category: "canceled" },
          ],
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
        compliance_status: "not_started",
      },
    },
  },
  {
    slug: "financial-report",
    name: "Financial Report",
    description: "Summary, key figures with variance, and outlook for a reporting period",
    structure_json: doc(
      heading(2, "Summary"),
      tip("The headline story of this period's numbers."),
      paragraph(text("[Summary.]")),
      heading(2, "Key Figures"),
      tip("This period vs. last, with the variance called out explicitly."),
      table(
        ["Line Item", "This Period", "Last Period", "Variance"],
        [["[Line item]", "[Value]", "[Value]", "[+/- %]"]],
      ),
      heading(2, "Notable Variances"),
      tip("Anything that moved more than expected, and why."),
      bullet(["[Variance and explanation]"]),
      heading(2, "Outlook"),
      tip("What you expect next period, and any risks to that outlook."),
      paragraph(text("[Outlook.]")),
    ),
    metadata: {
      document_type: "financial_report",
      use_cases: ["Board reporting", "Investor updates", "Internal finance reviews"],
      supported_views: ["dashboard", "calendar", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "report_period",
          field_label: "Report period",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "report_type",
          field_label: "Report type",
          field_type: "select",
          options: ["p_and_l", "balance_sheet", "cash_flow", "budget_vs_actual"],
          ai_fill_enabled: true,
        },
        {
          field_key: "currency",
          field_label: "Currency",
          field_type: "text",
          ai_fill_enabled: false,
        },
      ]),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "research-paper",
    name: "Research Paper",
    description: "Abstract, methodology, results, discussion, and references",
    structure_json: doc(
      heading(2, "Abstract"),
      tip("The whole paper in 150-250 words — problem, method, key result."),
      paragraph(text("[Abstract.]")),
      heading(2, "Introduction"),
      tip("The gap in existing knowledge this paper addresses."),
      paragraph(text("[Introduction.]")),
      heading(2, "Methodology"),
      tip("How the research was conducted, in enough detail to replicate."),
      paragraph(text("[Methodology.]")),
      heading(2, "Results"),
      tip("What was found — data and observations, without interpretation yet."),
      paragraph(text("[Results.]")),
      heading(2, "Discussion"),
      tip("What the results mean, their limitations, and implications."),
      paragraph(text("[Discussion.]")),
      heading(2, "References"),
      tip("Every source cited, formatted per the target venue's style."),
      bullet(["[Reference]"]),
    ),
    metadata: {
      document_type: "research_paper",
      use_cases: ["Journal submissions", "Conference papers", "Preprints"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "paper_status",
          field_label: "Paper status",
          field_type: "status",
          options: [
            { value: "drafting", label: "Drafting", category: "unstarted" },
            { value: "under_review", label: "Under review", category: "started" },
            { value: "revision", label: "Revision", category: "started" },
            { value: "accepted", label: "Accepted", category: "completed" },
            { value: "published", label: "Published", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "journal_or_venue",
          field_label: "Journal / venue",
          field_type: "text",
          ai_fill_enabled: true,
        },
        ...ACADEMIC_RESEARCH_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        paper_status: "drafting",
      },
    },
  },
  {
    slug: "thesis",
    name: "Thesis",
    description: "Abstract, research question, literature review, methodology, and findings",
    structure_json: doc(
      heading(2, "Abstract"),
      tip("The thesis in miniature — question, method, and conclusion."),
      paragraph(text("[Abstract.]")),
      heading(2, "Introduction & Research Question"),
      tip("Why this question matters, and precisely what it is."),
      paragraph(text("[Introduction and research question.]")),
      heading(2, "Literature Review"),
      tip("What's already known, and where this thesis fits in."),
      paragraph(text("[Literature review.]")),
      heading(2, "Methodology"),
      tip("How the research question was investigated."),
      paragraph(text("[Methodology.]")),
      heading(2, "Findings"),
      tip("What the research revealed."),
      paragraph(text("[Findings.]")),
      heading(2, "Conclusion & Future Work"),
      tip("What this means, and what's left to explore."),
      paragraph(text("[Conclusion and future work.]")),
      heading(2, "References"),
      tip("Every source cited."),
      bullet(["[Reference]"]),
    ),
    metadata: {
      document_type: "thesis",
      use_cases: ["Bachelor thesis", "Master thesis", "PhD dissertations"],
      supported_views: ["wiki", "kanban", "gantt"],
      schema_fields: withEssentials([
        {
          field_key: "thesis_level",
          field_label: "Thesis level",
          field_type: "select",
          options: ["bachelor", "master", "phd"],
          ai_fill_enabled: true,
        },
        {
          field_key: "thesis_status",
          field_label: "Thesis status",
          field_type: "status",
          options: [
            { value: "proposal", label: "Proposal", category: "unstarted" },
            { value: "writing", label: "Writing", category: "started" },
            { value: "review", label: "Review", category: "started" },
            { value: "defense_scheduled", label: "Defense scheduled", category: "started" },
            { value: "completed", label: "Completed", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "advisor",
          field_label: "Advisor",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "defense_date",
          field_label: "Defense date",
          field_type: "date",
          ai_fill_enabled: true,
        },
        ...ACADEMIC_RESEARCH_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        thesis_level: "bachelor",
        thesis_status: "proposal",
      },
    },
  },
  {
    slug: "student-essay",
    name: "Student Essay",
    description: "Thesis statement, argument, counterarguments, and conclusion",
    structure_json: doc(
      heading(2, "Thesis Statement"),
      tip("The single claim this essay argues for, in one sentence."),
      paragraph(text("[Thesis statement.]")),
      heading(2, "Body Paragraphs / Argument"),
      tip("Each point supporting the thesis, with evidence."),
      paragraph(text("[Argument and evidence.]")),
      heading(2, "Counterarguments"),
      tip("The strongest objection to your thesis, and your response to it."),
      paragraph(text("[Counterargument and response.]")),
      heading(2, "Conclusion"),
      tip("Restate the thesis in light of the argument, and its wider significance."),
      paragraph(text("[Conclusion.]")),
      heading(2, "References"),
      tip("Every source cited."),
      bullet(["[Reference]"]),
    ),
    metadata: {
      document_type: "student_essay",
      use_cases: ["Coursework essays", "Argumentative writing", "Exam preparation"],
      supported_views: ["wiki", "calendar"],
      schema_fields: withEssentials([
        {
          field_key: "course",
          field_label: "Course",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "word_count_target",
          field_label: "Word count target",
          field_type: "number",
          ai_fill_enabled: false,
        },
        {
          field_key: "essay_status",
          field_label: "Essay status",
          field_type: "status",
          options: [
            { value: "outline", label: "Outline", category: "unstarted" },
            { value: "drafting", label: "Drafting", category: "started" },
            { value: "revising", label: "Revising", category: "started" },
            { value: "submitted", label: "Submitted", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
        essay_status: "outline",
      },
    },
  },
  {
    slug: "literature-review",
    name: "Literature Review",
    description: "Sources reviewed, synthesis of themes, and gaps in the literature",
    structure_json: doc(
      heading(2, "Research Question / Scope"),
      tip("What this review is trying to answer, and its boundaries."),
      paragraph(text("[Research question and scope.]")),
      heading(2, "Sources Reviewed"),
      tip("Every source, with its key finding and relevance to your question."),
      table(
        ["Source", "Key Findings", "Relevance"],
        [["[Source]", "[Key finding]", "[Relevance]"]],
      ),
      heading(2, "Synthesis & Themes"),
      tip("The patterns and disagreements across sources — not a list, a synthesis."),
      paragraph(text("[Synthesis and themes.]")),
      heading(2, "Gaps in Literature"),
      tip("What's missing — this is often where your own research question lives."),
      bullet(["[Gap]"]),
    ),
    metadata: {
      document_type: "literature_review",
      use_cases: ["Thesis background chapters", "Systematic reviews", "Research proposals"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "research_area",
          field_label: "Research area",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "review_status",
          field_label: "Review status",
          field_type: "status",
          options: [
            { value: "scoping", label: "Scoping", category: "unstarted" },
            { value: "reviewing", label: "Reviewing", category: "started" },
            { value: "synthesizing", label: "Synthesizing", category: "started" },
            { value: "complete", label: "Complete", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        ...ACADEMIC_RESEARCH_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        review_status: "scoping",
      },
    },
  },
];

export function getSystemTemplateSeed(slug: string): SystemTemplateSeed | undefined {
  return SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
}

export function isEssentialTemplateFieldKey(fieldKey: string): boolean {
  return (ESSENTIAL_TEMPLATE_FIELD_KEYS as readonly string[]).includes(fieldKey);
}
