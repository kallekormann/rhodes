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
  | "literature-review"
  | "ticket";

export type TemplateCategoryId =
  | "essentials"
  | "product"
  | "marketing"
  | "operations"
  | "professional";

/** Browse tabs on the Templates page (Mine is separate — user-owned only). Max 5. */
export const TEMPLATE_CATEGORY_CATALOG = [
  { id: "essentials", label: "Essentials" },
  { id: "product", label: "Product" },
  { id: "marketing", label: "Marketing" },
  { id: "operations", label: "Operations" },
  { id: "professional", label: "Professional" },
] as const satisfies readonly { id: TemplateCategoryId; label: string }[];

export function templateCategoryLabel(id: TemplateCategoryId): string {
  return (
    TEMPLATE_CATEGORY_CATALOG.find((entry) => entry.id === id)?.label ?? id
  );
}

export type TemplateSchemaFieldSeed = MetadataFieldSeed & {
  ai_fill_enabled?: boolean;
};

export type TemplateSchemaGroupFieldSeed = {
  sub_key: string;
  field_label: string;
  field_type: TemplateSchemaFieldSeed["field_type"];
  options?: TemplateSchemaFieldSeed["options"];
  ai_fill_enabled?: boolean;
};

export type TemplateSchemaGroupSeed = {
  group_key: string;
  group_label: string;
  /** Non-repeatable by default for targeting / ICE / KPI definition blocks. */
  repeatable?: boolean;
  fields: TemplateSchemaGroupFieldSeed[];
};

export type SystemTemplateSeed = {
  slug: SystemTemplateSlug;
  name: string;
  description: string;
  structure_json: Record<string, unknown>;
  metadata: {
    document_type: string;
    /** Templates page browse category (system templates). */
    category: TemplateCategoryId;
    use_cases: string[];
    supported_views: string[];
    schema_fields: TemplateSchemaFieldSeed[];
    /** Optional workspace property groups seeded with this template. */
    schema_groups?: TemplateSchemaGroupSeed[];
    default_properties: Record<string, string | number | boolean | null>;
  };
};

/** Denormalized field_key for a group sub-property (`ice_impact`). */
export function groupFieldKey(groupKey: string, subKey: string): string {
  return `${groupKey}_${subKey}`;
}

/** Essentials every template ships — soft-locked from delete in Properties Manage. */
export const ESSENTIAL_TEMPLATE_FIELD_KEYS = [
  "status",
  "due_date",
  "owner",
  "summary",
  "origin",
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
  ticket: "Ticket",
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
  {
    field_key: "origin",
    field_label: "Origin",
    field_type: "relation",
    ai_fill_enabled: false,
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
    field_type: "tags",
    ai_fill_enabled: true,
  },
];

/** Product Discovery & UX fields — shared by PRD / Product Feature / User Flow Definition. */
const PRODUCT_DISCOVERY_SCHEMA_FIELDS: TemplateSchemaFieldSeed[] = [
  {
    field_key: "product_area",
    field_label: "Product area",
    field_type: "tags",
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
    field_type: "relation",
    ai_fill_enabled: false,
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
    field_type: "relation",
    ai_fill_enabled: false,
  },
  {
    field_key: "manager",
    field_label: "Manager",
    field_type: "relation",
    ai_fill_enabled: false,
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
    field_type: "tags",
    ai_fill_enabled: true,
  },
  {
    field_key: "counterparty",
    field_label: "Counterparty",
    field_type: "relation",
    ai_fill_enabled: false,
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
  options?: { omit?: readonly string[] },
): TemplateSchemaFieldSeed[] {
  const omit = new Set(options?.omit ?? []);
  const base = ESSENTIAL_SCHEMA_FIELDS.filter(
    (field) => !omit.has(field.field_key),
  );
  const seen = new Set(base.map((f) => f.field_key));
  return [
    ...base,
    ...extra.filter((field) => !seen.has(field.field_key)),
  ];
}

const TARGETING_FIELD_DEFS = {
  product: {
    sub_key: "product",
    field_label: "Product",
    field_type: "text" as const,
    ai_fill_enabled: true,
  },
  market: {
    sub_key: "market",
    field_label: "Market",
    field_type: "text" as const,
    ai_fill_enabled: true,
  },
  audience: {
    sub_key: "audience",
    field_label: "Audience",
    field_type: "text" as const,
    ai_fill_enabled: true,
  },
  surface: {
    sub_key: "surface",
    field_label: "Surface",
    field_type: "text" as const,
    ai_fill_enabled: true,
  },
  channel: {
    sub_key: "channel",
    field_label: "Channel",
    field_type: "text" as const,
    ai_fill_enabled: true,
  },
  country: {
    sub_key: "country",
    field_label: "Country",
    field_type: "text" as const,
    ai_fill_enabled: true,
  },
} satisfies Record<string, TemplateSchemaGroupFieldSeed>;

type TargetingSubKey = keyof typeof TARGETING_FIELD_DEFS;

/** Shared Targeting group — product / market / audience / surface / channel / country. */
function targetingGroup(
  subKeys: readonly TargetingSubKey[],
  groupKey = "targeting",
): TemplateSchemaGroupSeed {
  return {
    group_key: groupKey,
    group_label: "Targeting",
    repeatable: false,
    fields: subKeys.map((key) => TARGETING_FIELD_DEFS[key]),
  };
}

/** ICE prioritization group (Impact / Confidence / Ease). */
function iceGroup(): TemplateSchemaGroupSeed {
  return {
    group_key: "ice",
    group_label: "ICE",
    repeatable: false,
    fields: [
      {
        sub_key: "impact",
        field_label: "Impact (1–10)",
        field_type: "number",
        ai_fill_enabled: false,
      },
      {
        sub_key: "confidence",
        field_label: "Confidence (1–10)",
        field_type: "number",
        ai_fill_enabled: false,
      },
      {
        sub_key: "ease",
        field_label: "Ease / effort (1–10)",
        field_type: "number",
        ai_fill_enabled: false,
      },
    ],
  };
}

function kpiDefinitionGroup(
  groupKey: string,
  groupLabel: string,
): TemplateSchemaGroupSeed {
  return {
    group_key: groupKey,
    group_label: groupLabel,
    repeatable: false,
    fields: [
      {
        sub_key: "label",
        field_label: "Label",
        field_type: "text",
        ai_fill_enabled: true,
      },
      {
        sub_key: "baseline",
        field_label: "Baseline",
        field_type: "text",
        ai_fill_enabled: true,
      },
      {
        sub_key: "lift_pct",
        field_label: "Lift (%)",
        field_type: "number",
        options: { unit: "%" },
        ai_fill_enabled: true,
      },
    ],
  };
}

function moneyGroup(
  groupKey: string,
  groupLabel: string,
): TemplateSchemaGroupSeed {
  return {
    group_key: groupKey,
    group_label: groupLabel,
    repeatable: false,
    fields: [
      {
        sub_key: "amount",
        field_label: "Amount",
        field_type: "number",
        ai_fill_enabled: true,
      },
      {
        sub_key: "currency",
        field_label: "Currency",
        field_type: "text",
        ai_fill_enabled: true,
      },
    ],
  };
}

function kpiResultGroup(
  groupKey: string,
  groupLabel: string,
): TemplateSchemaGroupSeed {
  return {
    group_key: groupKey,
    group_label: groupLabel,
    repeatable: false,
    fields: [
      {
        sub_key: "label",
        field_label: "Label",
        field_type: "text",
        ai_fill_enabled: false,
      },
      {
        sub_key: "value",
        field_label: "Observed value",
        field_type: "text",
        ai_fill_enabled: false,
      },
    ],
  };
}

/** Pre-launch power analysis — MDE, sample size, and traffic. */
function experimentPowerGroup(): TemplateSchemaGroupSeed {
  return {
    group_key: "power",
    group_label: "Sample size & MDE",
    repeatable: false,
    fields: [
      {
        sub_key: "mde",
        field_label: "Minimum detectable effect",
        field_type: "text",
        ai_fill_enabled: true,
      },
      {
        sub_key: "sample_size",
        field_label: "Sample size (per variant)",
        field_type: "number",
        ai_fill_enabled: false,
      },
      {
        sub_key: "traffic_per_day",
        field_label: "Eligible traffic / day",
        field_type: "number",
        ai_fill_enabled: false,
      },
    ],
  };
}

export const SYSTEM_TEMPLATE_SEEDS: readonly SystemTemplateSeed[] = [
  {
    slug: "blank",
    name: "Blank",
    description: "Start from an empty page",
    structure_json: doc(paragraph()),
    metadata: {
      document_type: "note",
      category: "essentials",
      use_cases: ["Quick notes", "Freeform drafts", "Anything unstructured"],
      supported_views: [
        "wiki",
        "kanban",
        "calendar",
        "gantt",
        "dashboard",
        "mindmap",
        "graph",
      ],
      schema_fields: withEssentials(),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "ticket",
    name: "Ticket",
    description:
      "Lightweight work item for Kanban — context, acceptance criteria, and notes",
    structure_json: doc(
      heading(2, "Context"),
      tip(
        "What needs doing, why it matters, and any links (bug report, brief, PRD). Keep this short — the board card is the unit of work.",
      ),
      paragraph(text("[Context.]")),
      heading(2, "Acceptance Criteria"),
      tip("Done-when conditions. Prefer checkable bullets so reviewers share one definition of done."),
      bullet(["[Criterion]", "[Criterion]"]),
      heading(2, "Notes & Links"),
      tip("Implementation notes, screenshots, or links to PRs and related docs."),
      paragraph(text("[Notes.]")),
    ),
    metadata: {
      document_type: "ticket",
      category: "essentials",
      use_cases: [
        "Engineering backlog tickets",
        "Marketing task cards",
        "Ops / support work items",
      ],
      supported_views: ["kanban", "calendar", "gantt", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "ticket_priority",
          field_label: "Priority",
          field_type: "select",
          options: ["urgent", "high", "medium", "low"],
          ai_fill_enabled: true,
        },
        {
          field_key: "ticket_type",
          field_label: "Ticket type",
          field_type: "tags",
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
        ticket_priority: "medium",
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
      tip("Who owns what, and by when. Prefer @Name + due date in each bullet."),
      bullet([
        "@Name – [Task description] – Due: [Date]",
        "@Name – [Task description] – Due: [Date]",
      ]),
    ),
    metadata: {
      document_type: "meeting_notes",
      category: "essentials",
      use_cases: ["Team syncs", "Client calls", "Sprint planning", "Decision meetings"],
      supported_views: ["calendar", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "meeting_date",
          field_label: "Meeting date",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "meeting_type",
          field_label: "Meeting type",
          field_type: "select",
          options: [
            "team_sync",
            "client",
            "planning",
            "standup",
            "retro",
            "other",
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "attendees",
          field_label: "Attendees",
          field_type: "textarea",
          ai_fill_enabled: true,
        },
        {
          field_key: "meeting_link",
          field_label: "Meeting link",
          field_type: "url",
          ai_fill_enabled: false,
        },
        {
          field_key: "location",
          field_label: "Location",
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
    slug: "product-spec",
    name: "Product Spec",
    description:
      "Hypothesis-driven growth/feature spec — use for experiments and data-backed bets (not large epics; see PRD)",
    structure_json: doc(
      heading(2, "Problem & Insight"),
      tip(
        "What problem are we solving, and what evidence validates it? Link related Insight or Problem docs via Properties → Origin.",
      ),
      paragraph(
        text(
          "[Describe the core problem and the user insight or data that validates it.]",
        ),
      ),
      heading(2, "Hypothesis"),
      tip("If / then / because — keep it falsifiable. Prefer this template when the change is a testable bet."),
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
      tip("Walk through the journey in order. Link a User Flow Definition via Origin when the path is complex."),
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
      category: "product",
      use_cases: [
        "Growth / experiment-backed features",
        "Hypothesis-driven specs",
        "Falsifiable product bets",
      ],
      supported_views: ["kanban", "gantt", "dashboard"],
      schema_fields: withEssentials([
        {
          field_key: "spec_priority",
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
      schema_groups: [kpiDefinitionGroup("primary_kpi", "Primary KPI")],
      default_properties: {
        status: "draft",
        spec_priority: "p2",
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
      category: "essentials",
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
      category: "operations",
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
      category: "operations",
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
      category: "operations",
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
    description:
      "Hypothesis-driven experiment brief with ICE scoring, KPIs, variants, and decision",
    structure_json: doc(
      heading(2, "Problem / Insight"),
      tip(
        "Link the Problem or Insight document in Properties → Origin, then summarize the evidence that motivates this test.",
      ),
      paragraph(text("[What did we learn or observe that justifies running this experiment?]")),
      heading(2, "Problem Statement"),
      tip("State the business or user symptom — not the solution."),
      paragraph(text("[e.g. Trial-to-paid conversion is flat despite traffic growth.]")),
      heading(2, "How Might We"),
      tip("Frame the opportunity as a How Might We question before locking the change."),
      paragraph(text("[How might we …?]")),
      heading(2, "Hypothesis"),
      tip(
        "If we [change], then [primary metric] will [direction], because [behavioral mechanism]. Capture Product / Market / Audience / Surface in Properties → Targeting.",
      ),
      paragraph(
        text("If we "),
        text("[change]", true),
        text(", then "),
        text("[primary metric]", true),
        text(" will "),
        text("[increase/decrease]", true),
        text(", because "),
        text("[underlying reasoning].", true),
      ),
      heading(2, "Rationale"),
      tip("Evidence, prior tests, or behavioral theory that supports the mechanism."),
      paragraph(text("[Why this change should move the metric.]")),
      heading(2, "Falsification"),
      tip("What result would prove the hypothesis wrong? Write this before you launch."),
      paragraph(text("[We will reject the hypothesis if …]")),
      heading(2, "Decision Rule"),
      tip(
        "Pre-commit Win / Lose / Inconclusive actions (and financial framing) before seeing results. Capture Result + Decision selects in Properties after the run.",
      ),
      bullet([
        "Win — [action, e.g. roll out to 100%]",
        "Lose — [action, e.g. revert / do nothing]",
        "Inconclusive — [action, e.g. iterate or gather more evidence]",
      ]),
      heading(2, "Sample Size & MDE"),
      tip(
        "Pre-commit power before launch: fill Properties → Sample size & MDE (MDE, sample size per variant, eligible traffic/day). Also set Launch date and Planned duration (days).",
      ),
      bullet([
        "MDE: [smallest lift worth detecting — see Properties]",
        "Planned duration: [days or weeks]",
      ]),
      heading(2, "Variants"),
      tip(
        "For each variant: what changes (text/UI), any mockup image, and the change hypothesis — why this treatment should beat Control on the psychological trigger.",
      ),
      bullet([
        "Control — Experience: [current] — Change hypothesis: n/a (baseline)",
        "Variant B — Experience: [what changes; attach image] — Change hypothesis: [why this triggers better than Control]",
      ]),
      heading(2, "Risks & Dependencies"),
      tip("Material blockers only — eng capacity, analytics, legal, conflicting tests."),
      bullet(["[Risk or dependency]"]),
      heading(2, "Results: Insight, Learning & Decision"),
      tip(
        "After the run: fill Primary / Secondary / Guardrail KPI result groups (a green primary with a broken guardrail is usually a no-rollout). Set Result + Decision in Properties. Lifecycle is Experiment status only — use that for Kanban.",
      ),
      paragraph(text("[Insight:]")),
      paragraph(text("[Learning:]")),
      paragraph(text("[Decision:]")),
    ),
    metadata: {
      document_type: "ab_experiment",
      category: "product",
      use_cases: ["A/B tests", "Growth experiments", "Feature rollout validation"],
      supported_views: ["kanban", "dashboard", "gantt"],
      schema_fields: withEssentials(
        [
          {
            field_key: "ab_experiment_status",
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
            field_key: "launch_date",
            field_label: "Launch date",
            field_type: "date",
            ai_fill_enabled: true,
          },
          {
            field_key: "planned_duration_days",
            field_label: "Planned duration",
            field_type: "number",
            options: { unit: "days" },
            ai_fill_enabled: true,
          },
          {
            field_key: "traffic_split",
            field_label: "Traffic split",
            field_type: "text",
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
            field_label: "Funnel stage (AARRR)",
            field_type: "select",
            options: [
              "acquisition",
              "activation",
              "retention",
              "referral",
              "revenue",
            ],
            ai_fill_enabled: true,
          },
          {
            field_key: "growth_loop",
            field_label: "Growth loop",
            field_type: "text",
            ai_fill_enabled: true,
          },
          {
            field_key: "psychological_layer",
            field_label: "Psychological layer",
            field_type: "text",
            ai_fill_enabled: true,
          },
          {
            field_key: "cost_of_experimentation",
            field_label: "Cost of experimentation",
            field_type: "number",
            options: { unit: "days" },
            ai_fill_enabled: false,
          },
          {
            field_key: "experiment_result",
            field_label: "Result",
            field_type: "select",
            options: ["winner", "loser", "stopped", "inconclusive"],
            ai_fill_enabled: false,
          },
          {
            field_key: "experiment_decision",
            field_label: "Decision",
            field_type: "select",
            options: ["roll_out", "do_nothing", "iterate"],
            ai_fill_enabled: false,
          },
          {
            field_key: "erosion_risk",
            field_label: "Long-term erosion tracking",
            field_type: "checkbox",
            ai_fill_enabled: false,
          },
        ],
        // Experiment status is the single lifecycle for boards — omit generic status
        // (and due_date) to avoid dual fields drifting out of sync.
        { omit: ["due_date", "status"] },
      ),
      schema_groups: [
        targetingGroup(
          ["product", "market", "audience", "surface", "country"],
          "targeting_experiment",
        ),
        iceGroup(),
        kpiDefinitionGroup("primary_kpi", "Primary KPI"),
        kpiDefinitionGroup("secondary_kpi", "Secondary KPI"),
        kpiDefinitionGroup("guardrail_kpi", "Guardrail KPI"),
        experimentPowerGroup(),
        kpiResultGroup("primary_kpi_result", "Primary KPI result"),
        kpiResultGroup("secondary_kpi_result", "Secondary KPI result"),
        kpiResultGroup("guardrail_kpi_result", "Guardrail KPI result"),
      ],
      default_properties: {
        ab_experiment_status: "backlog",
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
      tip(
        "State the insight in one or two sentences. Link related Problem or Experiment docs via Properties → Origin when useful.",
      ),
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
      category: "product",
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
      tip(
        "What's broken or underperforming, for whom, and how do you know? Link related Insights via Properties → Origin.",
      ),
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
      category: "product",
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
      category: "product",
      use_cases: ["Scientific research", "Lab experiments", "Hypothesis testing"],
      supported_views: ["kanban", "gantt", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "science_experiment_status",
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
        {
          field_key: "allocation_split",
          field_label: "Allocation split",
          field_type: "text",
          ai_fill_enabled: true,
        },
      ]),
      default_properties: {
        status: "draft",
        science_experiment_status: "planned",
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
      category: "product",
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
      category: "product",
      use_cases: ["Engineering specs", "System design", "Requirements gathering"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "trd_priority",
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
        trd_priority: "medium",
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
      category: "product",
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
    description:
      "Delivery PRD for larger core epics — MoSCoW scope and user stories (not hypothesis growth bets; see Product Spec)",
    structure_json: doc(
      heading(2, "Problem Statement & Insight"),
      tip(
        "The problem this initiative solves, and the evidence behind it. Link related Problem or Insight docs via Properties → Origin.",
      ),
      paragraph(text("[Problem statement and supporting insight.]")),
      heading(2, "User Stories / How Might We"),
      tip(
        "Frame from the user's perspective. Prefer BDD-style stories: As a … I want to … so that …",
      ),
      bullet(["[As a ... I want to ... so that ...]", "[How might we ...?]"]),
      heading(2, "Scope & Requirements"),
      tip(
        "Negotiate Must / Should / Could / Won't before build. MoSCoW forces hard priority calls inside the epic.",
      ),
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
      heading(2, "Success Metrics & KPIs"),
      tip(
        "Even delivery epics need a readout — primary outcome plus guardrails so shipping doesn't silently erode core metrics.",
      ),
      bullet([
        "Primary KPI: [metric + target + baseline]",
        "Guardrail: [metric that must not degrade]",
        "How we'll measure: [source / dashboard]",
      ]),
    ),
    metadata: {
      document_type: "prd",
      category: "product",
      use_cases: [
        "Core epics / initiatives",
        "Cross-functional delivery",
        "MoSCoW scope management",
      ],
      supported_views: ["wiki", "kanban", "gantt"],
      schema_fields: withEssentials([
        {
          field_key: "prd_priority",
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
        prd_priority: "medium",
      },
    },
  },
  {
    slug: "product-feature",
    name: "Product Feature",
    description:
      "Tactical one-pager for bounded features — problem, solution, acceptance criteria (not full epics or growth hypotheses)",
    structure_json: doc(
      heading(2, "Problem & Opportunity"),
      tip(
        "What's the gap this small, bounded feature addresses? Link related Problem or Insight docs via Properties → Origin.",
      ),
      paragraph(text("[Problem and opportunity.]")),
      heading(2, "Proposed Solution"),
      tip(
        "What you're building, at a level a non-engineer can follow. Note what is explicitly out of scope to stop creep.",
      ),
      paragraph(text("[Proposed solution.]")),
      paragraph(text("Out of scope:", true)),
      bullet(["[What this feature will not do]"]),
      heading(2, "Acceptance Criteria"),
      tip(
        "Testable done-conditions. Prefer Given / When / Then so eng and QA share one definition of done.",
      ),
      bullet(["[Given ... when ... then ...]", "[Given ... when ... then ...]"]),
      heading(2, "Success Metrics"),
      tip(
        "How you'll validate after ship — avoid silent long-term metric erosion.",
      ),
      bullet(["[Metric and target]"]),
    ),
    metadata: {
      document_type: "product_feature",
      category: "product",
      use_cases: [
        "Tactical feature one-pagers",
        "Sprint backlog items",
        "Bounded delivery tickets",
      ],
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
    description:
      "Goal, happy path, decisions, edge cases, and success state for one user task",
    structure_json: doc(
      heading(2, "User & Goal"),
      tip(
        "Who is this for and what single task are they completing? Set Product / Market / Audience / Surface in Properties → Targeting (Audience = persona/segment).",
      ),
      paragraph(text("[Persona or role + goal in one sentence.]")),
      heading(2, "Entry Point"),
      tip("How the user arrives — URL, CTA, notification, deep link, or prior flow."),
      paragraph(text("[Entry point and trigger.]")),
      heading(2, "Happy Path"),
      tip(
        "Ordered screens and actions from entry to success. One goal per flow. Include a link to the Figma / FigJam canvas here.",
      ),
      ordered(["[Screen / action 1]", "[Screen / action 2]", "[Screen / action 3]"]),
      paragraph(text("[Figma / FigJam link:]")),
      heading(2, "Decision Points"),
      tip("Branches that change the path (auth, permissions, empty states, pricing tiers)."),
      bullet(["[Decision] — Yes → [path] / No → [path]"]),
      heading(2, "Edge Cases & Error States"),
      tip(
        "Empty states, validation errors, offline, permissions — flows fail here more often than on the happy path. No dead ends.",
      ),
      bullet(["[Edge case] — [System response / recovery]"]),
      heading(2, "Success State"),
      tip(
        "What the user sees once the flow completes. Note the analytics event that fires when the goal is reached.",
      ),
      paragraph(text("[Success state + confirmation / next CTA.]")),
      bullet(["Analytics event: [event name / properties]"]),
      heading(2, "Handoff Notes"),
      tip("Data passed between steps and open product/eng questions."),
      bullet(["[Event or data note]", "[Open question]"]),
    ),
    metadata: {
      document_type: "user_flow_definition",
      category: "product",
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
      schema_groups: [
        targetingGroup(["product", "market", "audience", "surface"], "targeting_flow"),
      ],
      default_properties: {
        status: "draft",
        flow_status: "draft",
      },
    },
  },
  {
    slug: "swot-analysis",
    name: "SWOT Analysis",
    description:
      "Scoped SWOT with strategic implications — living strategy context for PRDs, insights, and ADRs",
    structure_json: doc(
      heading(2, "Strengths"),
      tip("Internal advantages. Keep each item as a short bullet — no prose paragraphs."),
      bullet(["[Strength]"]),
      heading(2, "Weaknesses"),
      tip("Internal gaps or limitations. Short bullets only."),
      bullet(["[Weakness]"]),
      heading(2, "Opportunities"),
      tip("External factors you could capitalize on. Short bullets only."),
      bullet(["[Opportunity]"]),
      heading(2, "Threats"),
      tip("External factors that could work against you. Short bullets only."),
      bullet(["[Threat]"]),
      heading(2, "Strategic Implications / Action Items"),
      tip(
        "The 'so what' — how strengths unlock opportunities, and how you protect weaknesses against threats (TOWS). Prefer concrete next docs or experiments.",
      ),
      bullet([
        "SO: [Use strength X to capture opportunity Y]",
        "ST / WO / WT: [Mitigation or follow-up]",
        "Next: [Insight / Problem / PRD to open]",
      ]),
    ),
    metadata: {
      document_type: "swot_analysis",
      category: "product",
      use_cases: ["Strategic planning", "Competitive analysis", "Business reviews"],
      supported_views: ["wiki", "dashboard"],
      schema_fields: withEssentials([
        {
          field_key: "analysis_scope",
          field_label: "Analysis scope",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "competitor_name",
          field_label: "Competitor",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "last_audited",
          field_label: "Last audited",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "valid_until",
          field_label: "Valid until",
          field_type: "date",
          ai_fill_enabled: false,
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
    description:
      "Executive buy-in charter — objective, scope, sponsor, risks, and milestones for a cross-functional initiative",
    structure_json: doc(
      heading(2, "Objective & Business Case"),
      tip("What the project is, and why the business value justifies the investment."),
      paragraph(text("[Objective.]")),
      paragraph(text("[Business case / value.]")),
      heading(2, "Scope"),
      tip(
        "Must include what is strictly OUT of scope. Ambiguity here becomes budget and timeline risk later.",
      ),
      bullet(["In scope: [item]", "Out of scope: [item]"]),
      heading(2, "Stakeholders & Roles"),
      tip("Who's involved, and what they're responsible for. Sponsor lives in Properties."),
      bullet(["[Name/Role] — [Responsibility]"]),
      heading(2, "Key Risks & Constraints"),
      tip(
        "Surface material risks and hard constraints on day one — resources, deadlines, compliance — so you aren't measured against surprises later.",
      ),
      bullet(["[Risk or constraint] — [Mitigation / owner]"]),
      heading(2, "Milestones"),
      tip(
        "Keep as a clean table (Phase | Date | Deliverable) so it can feed Gantt / task tools later.",
      ),
      table(
        ["Phase", "Target date", "Deliverable", "Owner"],
        [["[Phase]", "[Date]", "[Deliverable]", "[Owner]"]],
      ),
      heading(2, "Success Criteria"),
      tip("How you'll know this project succeeded — outcomes, not activity."),
      bullet(["[Success criterion]"]),
    ),
    metadata: {
      document_type: "project_charter",
      category: "marketing",
      use_cases: ["Project kickoff", "Cross-functional initiatives", "Stakeholder alignment"],
      supported_views: ["wiki", "gantt", "kanban"],
      schema_fields: withEssentials(
        [
          {
            field_key: "project_timeframe",
            field_label: "Project timeframe",
            field_type: "date_range",
            ai_fill_enabled: true,
          },
          {
            field_key: "target_launch",
            field_label: "Target launch",
            field_type: "date",
            ai_fill_enabled: true,
          },
          ...GTM_PROJECT_SCHEMA_FIELDS,
        ],
        { omit: ["due_date"] },
      ),
      default_properties: {
        status: "draft",
      },
    },
  },
  {
    slug: "gtm-plan",
    name: "GTM Plan",
    description:
      "ICP, positioning, channels, enablement, and success metrics for a market launch",
    structure_json: doc(
      heading(2, "Business Goal"),
      tip(
        "What business outcome this GTM motion must deliver (pipeline, adoption, revenue). Set Market and Audience in Properties → Targeting. Set GTM tier for how loud this launch should be.",
      ),
      paragraph(text("[Primary business goal and time horizon.]")),
      heading(2, "ICP & Beachhead"),
      tip(
        "Ideal customer profile and the first segment you will win — industry, size, trigger events. Avoid 'everyone'.",
      ),
      bullet([
        "ICP: [firmographics / role / pains]",
        "Beachhead: [narrow first market]",
        "Exclusions: [who this is not for]",
      ]),
      heading(2, "Positioning & Messaging"),
      tip(
        "Value proposition vs status quo, and the single core message. Also clarify monetization: which plan/tier gets access, and is it included or paid?",
      ),
      paragraph(text("[Positioning statement.]")),
      bullet([
        "[Message pillar 1]",
        "[Message pillar 2]",
        "[Proof point / case study]",
        "Pricing / packaging: [included in … / add-on / usage-based]",
      ]),
      heading(2, "Channel Strategy"),
      tip(
        "Operative matrix — no vague 'we'll do social'. Channel | Tactic | Budget | Owner | Success metric.",
      ),
      table(
        ["Channel", "Tactic", "Budget", "Owner", "Success metric"],
        [["[Channel]", "[Tactic]", "[Amount]", "[Owner]", "[Metric]"]],
      ),
      heading(2, "Launch Sequencing"),
      tip(
        "Pre-launch → launch → post-launch. target_launch_date in Properties is the GTM push date — it may differ from code deploy.",
      ),
      table(
        ["Phase", "Milestone", "Owner", "Target date"],
        [
          ["Pre-launch", "[Milestone]", "[Owner]", "[Date]"],
          ["Launch", "[Milestone]", "[Owner]", "[Date]"],
          ["Post-launch", "[30/60/90 review]", "[Owner]", "[Date]"],
        ],
      ),
      heading(2, "Internal Enablement"),
      tip(
        "Customers must not hear about the launch before Sales and Support. Training dates, FAQ location, battle cards, and demo scripts.",
      ),
      bullet([
        "Sales enablement: [when / assets]",
        "Support FAQ / macros: [link]",
        "CS / AM briefing: [when]",
        "Internal announce: [when / channel]",
      ]),
      heading(2, "Success Metrics & Decision Rules"),
      tip(
        "Leading and lagging KPIs, plus what you do if the motion underperforms at day 30/60/90.",
      ),
      bullet([
        "Primary KPI: [metric + target]",
        "Guardrails: [CAC, win rate, cycle time]",
        "If off-track: [decision rule]",
      ]),
    ),
    metadata: {
      document_type: "gtm_plan",
      category: "marketing",
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
        {
          field_key: "gtm_tier",
          field_label: "GTM tier",
          field_type: "select",
          options: ["tier_1", "tier_2", "tier_3"],
          ai_fill_enabled: true,
        },
        ...GTM_PROJECT_SCHEMA_FIELDS,
      ]),
      schema_groups: [
        targetingGroup(["market", "audience"], "targeting_gtm"),
        kpiDefinitionGroup("primary_kpi", "Primary KPI"),
      ],
      default_properties: {
        status: "draft",
        gtm_status: "draft",
        gtm_tier: "tier_2",
      },
    },
  },
  {
    slug: "launch-checklist",
    name: "Launch Checklist",
    description:
      "Cross-functional readiness, go/no-go criteria, rollback, and post-launch review",
    structure_json: doc(
      heading(2, "Launch Scope"),
      tip(
        "What is shipping, to whom, and at what tier. Set Product and Market in Properties → Targeting. Paste the war-room link (Slack / Teams / open video call) here so the incident team knows where to gather.",
      ),
      paragraph(text("[Scope, audience, and launch tier.]")),
      paragraph(text("[War room / launch channel link:]")),
      heading(2, "Readiness Checklist"),
      tip(
        "Use the table: Area | Task | DRI | Status | Evidence. Every gate needs a named owner. 'In progress' is not ready at T-72h.",
      ),
      table(
        ["Area", "Task", "DRI", "Status", "Evidence"],
        [
          ["Product / QA", "[Gate]", "[Owner]", "[Not started]", "[Link]"],
          ["Engineering", "[Monitoring / rollback]", "[Owner]", "[Not started]", "[Link]"],
          ["Marketing / GTM", "[Assets / pages]", "[Owner]", "[Not started]", "[Link]"],
          ["Sales / CS", "[Enablement / macros]", "[Owner]", "[Not started]", "[Link]"],
          ["Legal / Privacy", "[Review]", "[Owner]", "[Not started]", "[Link]"],
          ["Analytics", "[Events / dashboards]", "[Owner]", "[Not started]", "[Link]"],
        ],
      ),
      heading(2, "Go / No-Go Criteria"),
      tip(
        "Conditions that must be true to launch. Named authority decides go, delay, or reduced scope — not sunk-cost momentum.",
      ),
      bullet([
        "[Criterion — must be true]",
        "Go/no-go meeting: [date, T-72h]",
        "Decision authority: [role/name]",
      ]),
      heading(2, "Launch Day Plan"),
      tip(
        "Comms timing, war-room coverage, feature flags / rollout phases. Keep the war-room link at the top of this doc.",
      ),
      bullet([
        "Internal announce: [when / channel]",
        "External announce: [when / channel]",
        "On-call / war room: [who + link]",
        "Rollout phases: [%, criteria to expand]",
      ]),
      heading(2, "Rollback Plan"),
      tip("Trigger, owner who can execute, and customer-facing recovery steps — write this before you need it."),
      paragraph(text("[Rollback trigger, owner, and steps.]")),
      heading(2, "Post-Launch Review"),
      tip("Retro within 72h and T+30 review against success criteria."),
      bullet([
        "Retro owner / date: […]",
        "Success criteria vs actuals: […]",
        "Follow-ups: […]",
      ]),
    ),
    metadata: {
      document_type: "launch_checklist",
      category: "marketing",
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
        {
          field_key: "launch_tier",
          field_label: "Launch tier",
          field_type: "select",
          options: ["soft", "ga", "major"],
          ai_fill_enabled: true,
        },
        {
          field_key: "go_nogo_date",
          field_label: "Go/no-go meeting",
          field_type: "date",
          ai_fill_enabled: false,
        },
      ]),
      schema_groups: [targetingGroup(["product", "market"], "targeting_launch")],
      default_properties: {
        status: "draft",
        launch_status: "planning",
      },
    },
  },
  {
    slug: "weekly-status",
    name: "Status Report",
    description:
      "Async status for stakeholders — metrics, wins, blockers, and next steps (TL;DR lives in Properties → Summary)",
    structure_json: doc(
      heading(2, "Key Metrics"),
      tip(
        "Put the TL;DR in Properties → Summary (don't duplicate it here). Below: the numbers that matter this period, with trend.",
      ),
      table(
        ["Metric", "This Period", "Trend"],
        [["[Metric]", "[Value]", "[↑/↓/→]"]],
      ),
      heading(2, "Wins"),
      tip("What went well since the last report — outcomes, not activity lists."),
      bullet(["[Win]"]),
      heading(2, "Risks & Blockers"),
      tip(
        "Make blockers actionable: tag the person who can unblock you (@Name) and what you need from them.",
      ),
      bullet(["[Risk] — @Name — [ask / decision needed]"]),
      heading(2, "Next Steps"),
      tip("What happens between now and the next report."),
      bullet(["[Next step]"]),
    ),
    metadata: {
      document_type: "weekly_status",
      category: "essentials",
      use_cases: ["Status updates", "Stakeholder reporting", "Project health checks"],
      supported_views: ["dashboard", "calendar", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "period_end",
          field_label: "Period ending",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "status_report_period",
          field_label: "Period label",
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
    description:
      "Objective, single key message, channels, budget, assets, and success metrics",
    structure_json: doc(
      heading(2, "Objective"),
      tip(
        "One campaign goal tied to a business outcome. Set Channel / Market / Audience in Properties → Targeting (same segments as experiments when possible).",
      ),
      paragraph(text("[Campaign objective.]")),
      heading(2, "Audience & Insight"),
      tip(
        "Who this is for, and the insight that makes the message land. Prefer the same Audience value as in Properties → Targeting.",
      ),
      paragraph(text("[Audience + insight.]")),
      heading(2, "Key Message"),
      tip(
        "One striking message — not three benefits at once. Define the exact Call-to-Action (CTA) the user should take.",
      ),
      paragraph(text("[Key message.]")),
      bullet(["[Proof point 1]", "[Proof point 2]", "CTA: [exact button / link action]"]),
      heading(2, "Channels & Tactics"),
      tip("Channel mix with tactic, owner, and timing. Keep primary Channel in Properties."),
      table(
        ["Channel", "Tactic", "Owner", "Timing"],
        [["[Channel]", "[Tactic]", "[Owner]", "[Dates]"]],
      ),
      heading(2, "Creative & Assets"),
      tip(
        "Deliverables for design/copy — formats, quantities, landing pages. Link Figma or Drive folders here so handoff is one click.",
      ),
      bullet(["[Asset — format / owner / due / link]"]),
      heading(2, "Budget & Timeline"),
      tip(
        "Total budget split and campaign window. Enter Budget in Properties as a number in your workspace currency (keep currency consistent across campaigns).",
      ),
      bullet([
        "Window: [start → end]",
        "Paid / creative / tools / contingency: [split]",
      ]),
      heading(2, "Success Metrics & Reporting"),
      tip("One primary metric, a few secondary, and reporting cadence."),
      bullet([
        "Primary: [metric + target + baseline]",
        "Secondary: [metric]",
        "Reporting: [daily / weekly / final]",
      ]),
      heading(2, "Approvals"),
      tip("Who must sign off before launch, and by when."),
      bullet(["[Stakeholder] — [what they approve] — Due: [date]"]),
    ),
    metadata: {
      document_type: "campaign_brief",
      category: "marketing",
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
          field_key: "channels",
          field_label: "Channel mix",
          field_type: "tags",
          ai_fill_enabled: true,
        },
        {
          field_key: "campaign_window",
          field_label: "Campaign window",
          field_type: "date_range",
          ai_fill_enabled: true,
        },
      ]),
      schema_groups: [
        targetingGroup(["channel", "market", "audience"], "targeting_content"),
        moneyGroup("budget", "Budget"),
        kpiDefinitionGroup("primary_kpi", "Primary KPI"),
      ],
      default_properties: {
        status: "draft",
        campaign_status: "planning",
      },
    },
  },
  {
    slug: "editorial-calendar",
    name: "Content Calendar Item",
    description:
      "Angle, outline, draft, SEO, distribution, and success metric for one content piece",
    structure_json: doc(
      heading(2, "Brief & Angle"),
      tip(
        "What this piece is about — and the unique angle nobody else has. Link the parent Campaign via Properties → Campaign. Set Market / Audience / Channel / Funnel stage in Properties.",
      ),
      paragraph(text("[Brief and angle.]")),
      heading(2, "Audience Job-to-Be-Done"),
      tip("What the reader is trying to accomplish after consuming this piece."),
      paragraph(text("[JTBD / reader outcome.]")),
      heading(2, "Outline"),
      tip("The structure this piece will follow (H2s as promises to the reader)."),
      ordered(["[Section 1]", "[Section 2]", "[Section 3]"]),
      heading(2, "Draft / Content"),
      tip(
        "Write the full piece here after the outline is locked. Keep brief/angle above as the contract.",
      ),
      paragraph(text("[Draft body…]")),
      heading(2, "SEO Keywords"),
      tip(
        "Primary/secondary keywords plus Meta Title and Meta Description (watch character limits for CMS handoff).",
      ),
      bullet([
        "Primary keyword: […]",
        "Secondary: […]",
        "Meta title (≤60 chars): […]",
        "Meta description (≤155 chars): […]",
      ]),
      heading(2, "Internal Links & CTA"),
      tip("Planned links in/out and the conversion action."),
      bullet(["[Link from/to]", "CTA: [action]"]),
      heading(2, "Distribution Plan"),
      tip("Where this gets published and promoted after ship."),
      bullet(["[Channel / date / owner]"]),
      heading(2, "Success Metric"),
      tip("One primary metric for this URL or asset — not vanity alone."),
      paragraph(text("[Primary metric + target.]")),
    ),
    metadata: {
      document_type: "editorial_calendar",
      category: "marketing",
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
            { value: "brief", label: "Brief", category: "unstarted" },
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
          options: ["blog", "video", "social", "newsletter", "podcast", "guide"],
          ai_fill_enabled: true,
        },
        {
          field_key: "funnel_stage",
          field_label: "Funnel stage (AARRR)",
          field_type: "select",
          options: [
            "acquisition",
            "activation",
            "retention",
            "referral",
            "revenue",
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "target_query",
          field_label: "Target query",
          field_type: "text",
          ai_fill_enabled: true,
        },
        ...CONTENT_MARKETING_SCHEMA_FIELDS,
      ]),
      schema_groups: [
        targetingGroup(["market", "audience", "channel"], "targeting_content"),
        kpiDefinitionGroup("primary_kpi", "Primary KPI"),
      ],
      default_properties: {
        status: "draft",
        content_status: "idea",
      },
    },
  },
  {
    slug: "seo-brief",
    name: "SEO Brief",
    description:
      "SERP strategy brief for pillar pages — intent, competitors, outline, and on-page requirements",
    structure_json: doc(
      heading(2, "Angle & SERP Strategy"),
      tip(
        "Keyword and intent live in Properties. Here: how we beat the SERP — information gain the top results lack. Set Market / Audience / Channel in Properties → Targeting.",
      ),
      paragraph(text("[How we win vs current top results.]")),
      heading(2, "Competing Pages"),
      tip("Top SERP winners — word count, angle, and the gap we exploit."),
      table(
        ["URL", "Word count", "Angle / gap"],
        [["[Competing URL]", "[n]", "[Notes]"]],
      ),
      heading(2, "Semantic Coverage"),
      tip("Secondary keywords, entities, and People Also Ask questions to address."),
      bullet(["[Secondary / related term]", "[PAA question]"]),
      heading(2, "Content Outline"),
      tip(
        "H2/H3 structure that satisfies intent better than the current SERP. Also lock URL slug, Meta Title, and Meta Description.",
      ),
      ordered(["[H2]", "[H2]", "[H2]"]),
      bullet([
        "URL slug: [/path]",
        "Meta title (≤60): […]",
        "Meta description (≤155): […]",
      ]),
      heading(2, "On-Page Requirements"),
      tip("Schema, word-count range, CTA, and any technical constraints."),
      bullet([
        "Schema: [type]",
        "Word count target: [range]",
        "CTA: […]",
      ]),
      heading(2, "Internal Linking Plan"),
      tip("Which existing pages should link to this, and what this page should link out to — avoid orphan pages."),
      bullet(["[Page to link from/to]"]),
    ),
    metadata: {
      document_type: "seo_brief",
      category: "marketing",
      use_cases: ["SEO content", "Pillar pages", "Landing page optimization"],
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
          field_key: "search_volume",
          field_label: "Search volume",
          field_type: "number",
          ai_fill_enabled: false,
        },
        {
          field_key: "keyword_difficulty",
          field_label: "Keyword difficulty",
          field_type: "number",
          ai_fill_enabled: false,
        },
        {
          field_key: "seo_word_count_target",
          field_label: "Word count target",
          field_type: "number",
          options: { unit: "words" },
          ai_fill_enabled: false,
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
      schema_groups: [
        targetingGroup(["market", "audience", "channel"], "targeting_content"),
      ],
      default_properties: {
        status: "draft",
        seo_status: "research",
      },
    },
  },
  {
    slug: "social-post-batch",
    name: "Social Post Batch",
    description:
      "Campaign-aligned post batch with platforms, copy, schedule, approvals, and learnings",
    structure_json: doc(
      heading(2, "Batch Objective"),
      tip(
        "What this batch should achieve for the campaign or pillar. Set Market / Audience / Channel in Properties → Targeting. Link Campaign in Properties.",
      ),
      paragraph(text("[Objective + campaign context.]")),
      heading(2, "Posts"),
      tip(
        "Batch for approval: Date | Platform | Copy | Visual asset link | CTA | Status. A post without a final media link is not ready for scheduling.",
      ),
      table(
        ["Date", "Platform", "Copy", "Visual / media link", "CTA", "Status"],
        [
          [
            "[Date]",
            "[Platform]",
            "[Copy]",
            "[Figma / Drive link]",
            "[CTA]",
            "[Draft]",
          ],
        ],
      ),
      heading(2, "Hashtags & Mentions"),
      tip("Reusable tags and accounts — keep lists short and relevant."),
      bullet(["[#hashtag]", "[@mention]"]),
      heading(2, "Compliance & Approvals"),
      tip("Claims, disclosures, and who must approve before scheduling (Buffer / Hootsuite)."),
      bullet(["[Reviewer] — [what they check]"]),
      heading(2, "Performance Notes"),
      tip(
        "What worked, what didn't. Did a post win or fail surprisingly? Turn that learning into an Insight document for the growth engine (link via Origin).",
      ),
      paragraph(text("[Wins, misses, and next experiments.]")),
    ),
    metadata: {
      document_type: "social_post_batch",
      category: "marketing",
      use_cases: ["Social scheduling", "Campaign amplification", "Always-on content"],
      supported_views: ["calendar", "kanban", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "batch_status",
          field_label: "Batch status",
          field_type: "status",
          options: [
            { value: "drafting", label: "Drafting", category: "unstarted" },
            { value: "in_review", label: "In review", category: "started" },
            { value: "approved", label: "Approved", category: "started" },
            { value: "scheduled", label: "Scheduled", category: "started" },
            { value: "published", label: "Published", category: "completed" },
          ],
          ai_fill_enabled: true,
        },
        {
          field_key: "platforms",
          field_label: "Platforms",
          field_type: "tags",
          ai_fill_enabled: true,
        },
        {
          field_key: "batch_window",
          field_label: "Batch window",
          field_type: "date_range",
          ai_fill_enabled: true,
        },
        ...CONTENT_MARKETING_SCHEMA_FIELDS,
      ]),
      schema_groups: [
        targetingGroup(["market", "audience", "channel"], "targeting_content"),
      ],
      default_properties: {
        status: "draft",
        batch_status: "drafting",
      },
    },
  },
  {
    slug: "digital-maturity-audit",
    name: "Digital Maturity Audit",
    description:
      "Score maturity dimensions, surface findings, and recommend a roadmap — ground zero before PRDs and GTM",
    structure_json: doc(
      heading(2, "Scope & Methodology"),
      tip(
        "What was assessed and how — interviews, tooling review, data analysis. Prevent 'you never checked system Y' later.",
      ),
      paragraph(text("[Scope and methodology.]")),
      heading(2, "Maturity Dimensions"),
      tip(
        "Use the table: Dimension | Current state | Target state | Gap. Largest gaps drive the roadmap first.",
      ),
      table(
        ["Dimension", "Current state", "Target state", "Gap"],
        [
          ["Strategy", "[1-5 / notes]", "[1-5 / notes]", "[Gap]"],
          ["Technology", "[1-5 / notes]", "[1-5 / notes]", "[Gap]"],
          ["Data", "[1-5 / notes]", "[1-5 / notes]", "[Gap]"],
          ["Culture", "[1-5 / notes]", "[1-5 / notes]", "[Gap]"],
          ["Process", "[1-5 / notes]", "[1-5 / notes]", "[Gap]"],
        ],
      ),
      heading(2, "Key Findings"),
      tip("The most important patterns across dimensions — 3-5 findings, not thirty."),
      bullet(["[Finding]"]),
      heading(2, "Recommendations & Roadmap"),
      tip(
        "Prioritized recommendations. Ready to execute? Create a Project Charter or PRD for the top 3 items and link them back via Origin.",
      ),
      bullet(["[Recommendation → linked initiative]"]),
    ),
    metadata: {
      document_type: "digital_maturity_audit",
      category: "professional",
      use_cases: ["Digital transformation", "Consulting engagements", "Technology assessments"],
      supported_views: ["wiki", "dashboard"],
      schema_fields: withEssentials([
        AUDIT_STATUS_FIELD,
        {
          field_key: "maturity_domain",
          field_label: "Audit domain",
          field_type: "tags",
          ai_fill_enabled: true,
        },
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
    description:
      "Risk-rated findings and action plan for financial, operational, compliance, or security audits",
    structure_json: doc(
      heading(2, "Executive Summary"),
      tip(
        "Pyramid principle — management reads this first. Two crisp paragraphs; generate after findings are complete if using Rhodes.",
      ),
      paragraph(text("[Executive summary.]")),
      heading(2, "Scope & Objectives"),
      tip("What's being audited, and what the audit needs to answer."),
      paragraph(text("[Scope and objectives.]")),
      heading(2, "Findings"),
      tip(
        "Risk-rated table: Finding | Risk level (High/Med/Low) | Impact | Mitigation. Tell leadership where the house is on fire.",
      ),
      table(
        ["Finding", "Risk level", "Impact", "Mitigation"],
        [["[Finding]", "[High/Med/Low]", "[Impact]", "[Mitigation]"]],
      ),
      heading(2, "Action Plan"),
      tip("What happens next, who owns it, and by when."),
      bullet(["[Action] — [Owner] — [Due date]"]),
    ),
    metadata: {
      document_type: "general_audit",
      category: "professional",
      use_cases: ["Financial audits", "Operational reviews", "Compliance and security audits"],
      supported_views: ["wiki", "dashboard"],
      schema_fields: withEssentials([
        AUDIT_STATUS_FIELD,
        {
          field_key: "audit_type",
          field_label: "Audit type",
          field_type: "tags",
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
    description:
      "Executive summary, market, model, GTM, team, and financials for a venture or strategic bet",
    structure_json: doc(
      heading(2, "Executive Summary"),
      tip("The whole plan in a paragraph — what, why, and why now. Investors often read only this."),
      paragraph(text("[Executive summary.]")),
      heading(2, "Market Analysis"),
      tip("The market size, target customer, and competitive landscape."),
      paragraph(text("[Market analysis.]")),
      heading(2, "Business Model"),
      tip("How this makes money — pricing, channels, and unit economics."),
      paragraph(text("[Business model.]")),
      heading(2, "Go-To-Market & Distribution"),
      tip(
        "How the product reaches customers. For detailed tactics, link a dedicated GTM Plan via Origin.",
      ),
      paragraph(text("[Channels, motion (PLG / sales), and early beachhead.]")),
      heading(2, "Financial Projections"),
      tip("Revenue, costs, and profit over the planning horizon. Capture funding/ARR targets in Properties too."),
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
      category: "professional",
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
      schema_groups: [
        moneyGroup("funding", "Funding"),
        moneyGroup("arr", "ARR"),
      ],
      default_properties: {
        status: "draft",
        stage: "idea",
      },
    },
  },
  {
    slug: "professional-business-letter",
    name: "Professional Business Letter",
    description: "Subject, salutation, body, and closing for a formal business letter",
    structure_json: doc(
      heading(2, "Salutation & Opening"),
      tip("Who you're addressing, and the reason for writing, stated up front (BLUF)."),
      paragraph(text("[Dear ..., I am writing to ...]")),
      heading(2, "Body"),
      tip(
        "The substance — context, details, and requests. Use bullet lists for proposals, terms, or numbered demands.",
      ),
      paragraph(text("[Body of the letter.]")),
      heading(2, "Closing & Signature"),
      tip(
        "Clear next step, formal sign-off, and list any attached documents or enclosures here.",
      ),
      paragraph(text("[Sincerely, / Best regards,]")),
      paragraph(text("Enclosures: [none / list]")),
    ),
    metadata: {
      document_type: "professional_business_letter",
      category: "professional",
      use_cases: ["Cover letters", "Client proposals", "Formal notices and references"],
      supported_views: ["wiki"],
      schema_fields: withEssentials([
        {
          field_key: "letter_type",
          field_label: "Letter type",
          field_type: "tags",
          ai_fill_enabled: true,
        },
        {
          field_key: "subject_line",
          field_label: "Subject line",
          field_type: "text",
          ai_fill_enabled: true,
        },
        {
          field_key: "recipient",
          field_label: "Recipient",
          field_type: "relation",
          ai_fill_enabled: false,
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
      tip(
        "Is this just a status update, or are we discussing career growth? Touch long-term goals regularly.",
      ),
      bullet(["[Topic]"]),
      heading(2, "Action Items"),
      tip("Concrete follow-ups from this conversation, with an owner and due date."),
      table(
        ["Task", "Owner", "Due Date", "Status"],
        [["[Task]", "[Owner]", "[Date]", "[Not started]"]],
      ),
      heading(2, "Notes for Next Meeting"),
      tip("What to pick back up next time — Rhodes can seed the next 1:1 from this section."),
      paragraph(text("[Notes for next meeting.]")),
    ),
    metadata: {
      document_type: "one_on_one_notes",
      category: "operations",
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
          field_type: "relation",
          ai_fill_enabled: false,
        },
        {
          field_key: "manager",
          field_label: "Manager",
          field_type: "relation",
          ai_fill_enabled: false,
        },
        {
          field_key: "requires_hr_followup",
          field_label: "Requires HR follow-up",
          field_type: "checkbox",
          ai_fill_enabled: false,
        },
        {
          field_key: "visibility",
          field_label: "Visibility",
          field_type: "select",
          options: ["private", "managers", "hr"],
          ai_fill_enabled: false,
        },
      ]),
      default_properties: {
        status: "draft",
        visibility: "private",
      },
    },
  },
  {
    slug: "personal-development-plan",
    name: "Personal Development Plan",
    description: "Career goals, skill development areas, and a check-in schedule",
    structure_json: doc(
      heading(2, "Career Goals"),
      tip(
        "Where this person wants to grow. Link each goal to a real project — which ab-experiment or product-feature will they lead next quarter to prove the skill?",
      ),
      paragraph(text("[Career goals.]")),
      heading(2, "Development Areas"),
      tip(
        "Reference internal skill / role frameworks (e.g. Lead Experience Architect, Senior Fullstack Architect, Strategic Product Leadership). Make Target Level measurable.",
      ),
      table(
        ["Skill / Competency", "Current Level", "Target Level", "Action"],
        [["[Skill]", "[Current]", "[Target]", "[Action]"]],
      ),
      heading(2, "Support Needed"),
      tip("What has to be true — budget, mentorship, time — for this plan to work."),
      bullet(["[Support needed]"]),
      heading(2, "Check-in Schedule"),
      tip("When you'll revisit this plan together (e.g. every 3 months)."),
      paragraph(text("[Check-in cadence.]")),
    ),
    metadata: {
      document_type: "personal_development_plan",
      category: "operations",
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
      tip(
        "Day-to-day ownership. Include measurable impact — experiments owned, KPIs owned — not only task lists. Link skill frameworks where helpful.",
      ),
      bullet(["[Responsibility]"]),
      heading(2, "Requirements"),
      tip(
        "Must-haves only. Link internal skill docs or expectation frameworks so candidates and hiring managers share one standard.",
      ),
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
      category: "operations",
      use_cases: ["Hiring", "Role definition", "Org design"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "department",
          field_label: "Department",
          field_type: "tags",
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
      tip(
        "What was agreed this period, and how it went. Link shipped product-features or ab-experiments as evidence.",
      ),
      table(
        ["Goal", "Result", "Rating"],
        [["[Goal]", "[Result]", "[Exceeds / Meets / Needs development]"]],
      ),
      heading(2, "Strengths"),
      tip("What's working well — be specific, not generic."),
      bullet(["[Strength]"]),
      heading(2, "Areas for Growth"),
      tip(
        "What would make the next period better. Sync these insights into the employee's personal-development-plan.",
      ),
      bullet(["[Area for growth]"]),
      heading(2, "Next Period Goals"),
      tip(
        "What's agreed for the upcoming period — mirror into the PDP so review and growth stay linked.",
      ),
      bullet(["[Goal]"]),
    ),
    metadata: {
      document_type: "performance_review",
      category: "operations",
      use_cases: ["Performance cycles", "Promotion cases", "Manager feedback"],
      supported_views: ["wiki", "kanban", "calendar"],
      schema_fields: withEssentials([
        {
          field_key: "performance_review_status",
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
          options: [
            "exceeds_expectations",
            "meets_expectations",
            "needs_development",
            "unsatisfactory",
          ],
          ai_fill_enabled: false,
        },
        ...PEOPLE_OPS_SCHEMA_FIELDS,
      ]),
      default_properties: {
        status: "draft",
        performance_review_status: "self_review",
      },
    },
  },
  {
    slug: "legal-document",
    name: "Legal Document",
    description: "Parties, terms, obligations, termination, and signatures",
    structure_json: doc(
      heading(2, "Parties"),
      tip("Who is bound by this document, with full legal names. Set Counterparty in Properties."),
      bullet(["[Party A]", "[Party B]"]),
      heading(2, "Terms & Conditions"),
      tip(
        "Substantive terms both parties agree to. Ensure boilerplate and indemnities are reviewed by qualified counsel before execution.",
      ),
      paragraph(text("[Terms and conditions.]")),
      heading(2, "Obligations"),
      tip("What each party must deliver or do, and by when."),
      bullet(["[Party A obligation]", "[Party B obligation]"]),
      heading(2, "Term, Termination & Renewal"),
      tip(
        "Initial term, notice periods, auto-renewal, and exit rights — missing this is how evergreen traps happen.",
      ),
      paragraph(text("[Term, termination, and renewal.]")),
      heading(2, "Signatures"),
      tip("Signature blocks for each party, with date."),
      paragraph(text("[Signature blocks.]")),
    ),
    metadata: {
      document_type: "legal_document",
      category: "professional",
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
      tip(
        "What this contract is for and who the counterparty is. Link or attach the raw PDF / source document here.",
      ),
      paragraph(text("[Contract summary.]")),
      heading(2, "Key Terms"),
      tip(
        "Terms that matter most, with clause refs. Explicitly cover Liability, Indemnity, IP, and Data Privacy (GDPR/DSGVO).",
      ),
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
      category: "professional",
      use_cases: ["Vendor contracts", "Customer agreements", "Legal review workflows"],
      supported_views: ["kanban", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "renewal_date",
          field_label: "Renewal date",
          field_type: "date",
          ai_fill_enabled: true,
        },
        {
          field_key: "contract_review_status",
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
      schema_groups: [moneyGroup("contract_value", "Contract value")],
      default_properties: {
        status: "draft",
        contract_review_status: "intake",
      },
    },
  },
  {
    slug: "compliance-checklist",
    name: "Compliance Checklist",
    description: "Requirements, evidence, and a remediation plan for a compliance framework",
    structure_json: doc(
      heading(2, "Requirements"),
      tip(
        "Every requirement under this framework, with owner and evidence. Link policies, SOPs, GitHub PRs, or infra configs that serve as audit evidence.",
      ),
      table(
        ["Requirement", "Owner", "Evidence", "Status"],
        [["[Requirement]", "[Owner]", "[Evidence]", "[Not started]"]],
      ),
      heading(2, "Gaps & Remediation Plan"),
      tip(
        "Where you're not yet compliant. Each gap needs an owner and a due date — align the document Due property with the soonest remediation deadline.",
      ),
      bullet(["[Gap] — Owner: […] — Due: […] — Plan: […]"]),
      heading(2, "Next Audit Date"),
      tip("When this needs to be reassessed."),
      paragraph(text("[Next audit date.]")),
    ),
    metadata: {
      document_type: "compliance_checklist",
      category: "professional",
      use_cases: ["Regulatory compliance", "Security certifications", "Internal audits"],
      supported_views: ["kanban", "wiki", "dashboard"],
      schema_fields: withEssentials([
        {
          field_key: "framework",
          field_label: "Framework",
          field_type: "tags",
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
        {
          field_key: "related_audit",
          field_label: "Related audit",
          field_type: "relation",
          ai_fill_enabled: false,
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
      tip(
        "The headline story of this period's numbers — lead with the takeaway for CFO / investors. Set Report period as Q3-2026 or M08-2026 for sortable dashboards.",
      ),
      paragraph(text("[Summary.]")),
      heading(2, "Key Figures"),
      tip(
        "This period vs. last, with variance. Link the original business-plan or department budgets as the approved baseline.",
      ),
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
      category: "professional",
      use_cases: ["Board reporting", "Investor updates", "Internal finance reviews"],
      supported_views: ["dashboard", "calendar", "wiki"],
      schema_fields: withEssentials([
        {
          field_key: "financial_report_period",
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
    description: "Abstract, related work, methodology, results, discussion, and references",
    structure_json: doc(
      heading(2, "Abstract"),
      tip("The whole paper in 150-250 words — problem, method, key result."),
      paragraph(text("[Abstract.]")),
      heading(2, "Introduction"),
      tip("The gap in existing knowledge this paper addresses."),
      paragraph(text("[Introduction.]")),
      heading(2, "Related Work & Literature Review"),
      tip("Place this work in the current research discourse — prior art and how you differ."),
      paragraph(text("[Related work.]")),
      heading(2, "Methodology"),
      tip("How the research was conducted, in enough detail to replicate."),
      paragraph(text("[Methodology.]")),
      heading(2, "Results"),
      tip("What was found — data and observations, without interpretation yet."),
      paragraph(text("[Results.]")),
      heading(2, "Discussion"),
      tip(
        "What the results mean and their implications. Explicitly disclose study limitations — peer reviewers expect this.",
      ),
      paragraph(text("[Discussion.]")),
      heading(2, "References"),
      tip("Every source cited, formatted per the target venue's style."),
      bullet(["[Reference]"]),
    ),
    metadata: {
      document_type: "research_paper",
      category: "professional",
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
    description: "Abstract, research question, literature review, methodology, findings, and defense prep",
    structure_json: doc(
      heading(2, "Abstract"),
      tip("The thesis in miniature — question, method, and conclusion."),
      paragraph(text("[Abstract.]")),
      heading(2, "Introduction & Research Question"),
      tip("Why this question matters, and precisely what it is."),
      paragraph(text("[Introduction and research question.]")),
      heading(2, "Literature Review"),
      tip(
        "What's already known, and where this thesis fits. Use H3/H4 subheadings to chapter long sections.",
      ),
      paragraph(text("[Literature review.]")),
      heading(2, "Methodology"),
      tip("How the research question was investigated. Use H3/H4 for chapter structure."),
      paragraph(text("[Methodology.]")),
      heading(2, "Findings"),
      tip("What the research revealed. Use H3/H4 for chapter structure."),
      paragraph(text("[Findings.]")),
      heading(2, "Conclusion & Future Work"),
      tip("What this means, and what's left to explore."),
      paragraph(text("[Conclusion and future work.]")),
      heading(2, "Defense Notes & Q&A Prep"),
      tip("Likely examiner questions, counterarguments, and your prepared responses."),
      bullet(["[Question / counterargument] — [Response]"]),
      heading(2, "References"),
      tip("Every source cited."),
      bullet(["[Reference]"]),
    ),
    metadata: {
      document_type: "thesis",
      category: "professional",
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
          field_type: "relation",
          ai_fill_enabled: false,
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
      tip(
        "Outline body paragraphs as bullets first, then expand into prose — that prevents blank-page block.",
      ),
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
      category: "professional",
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
          field_key: "essay_word_count_target",
          field_label: "Word count target",
          field_type: "number",
          options: { unit: "words" },
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
      tip(
        "Document exact search strings, databases (Scholar, IEEE, Scopus), and inclusion/exclusion criteria so the review is replicable.",
      ),
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
      category: "professional",
      use_cases: ["Thesis background chapters", "Systematic reviews", "Research proposals"],
      supported_views: ["wiki", "kanban"],
      schema_fields: withEssentials([
        {
          field_key: "research_area",
          field_label: "Research area",
          field_type: "tags",
          ai_fill_enabled: true,
        },
        {
          field_key: "literature_review_status",
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
        literature_review_status: "scoping",
      },
    },
  },
];

export function getSystemTemplateSeed(slug: string): SystemTemplateSeed | undefined {
  return SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
}

/** Resolve browse category for a system template slug (Templates page). */
export function resolveTemplateCategory(
  slug: string | null | undefined,
): TemplateCategoryId | null {
  if (!slug) return null;
  return getSystemTemplateSeed(slug)?.metadata.category ?? null;
}

export function isEssentialTemplateFieldKey(fieldKey: string): boolean {
  return (ESSENTIAL_TEMPLATE_FIELD_KEYS as readonly string[]).includes(fieldKey);
}

/**
 * Field keys shipped by the document's template (Tier B), resolved from
 * `template_slug` or `document_type`. Used to keep Properties view focused on
 * that document type instead of every schema seeded in the scope.
 */
export function resolveTemplateSchemaFieldKeys(
  metadata: Record<string, unknown> | null | undefined,
): Set<string> | null {
  const seed = resolveSystemTemplateSeed(metadata);
  const fields = seed?.metadata.schema_fields;
  if (!fields || fields.length === 0) return null;
  return new Set(fields.map((field) => field.field_key));
}

/**
 * Group keys shipped by the document's template (`schema_groups`).
 * Empty set means the template declares no groups (hide workspace groups in view).
 */
export function resolveTemplateSchemaGroupKeys(
  metadata: Record<string, unknown> | null | undefined,
): Set<string> | null {
  const seed = resolveSystemTemplateSeed(metadata);
  if (!seed) return null;
  const groups = seed.metadata.schema_groups ?? [];
  return new Set(groups.map((group) => group.group_key));
}

function resolveSystemTemplateSeed(
  metadata: Record<string, unknown> | null | undefined,
): SystemTemplateSeed | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;

  const slug =
    typeof metadata.template_slug === "string" && metadata.template_slug.trim()
      ? metadata.template_slug.trim()
      : null;
  const documentType =
    typeof metadata.document_type === "string" && metadata.document_type.trim()
      ? metadata.document_type.trim()
      : null;

  return (
    (slug ? getSystemTemplateSeed(slug) : undefined) ??
    (documentType
      ? SYSTEM_TEMPLATE_SEEDS.find(
          (entry) => entry.metadata.document_type === documentType,
        )
      : undefined)
  );
}
