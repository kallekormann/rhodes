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
  | "swot-analysis";

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
];

export function getSystemTemplateSeed(slug: string): SystemTemplateSeed | undefined {
  return SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
}

export function isEssentialTemplateFieldKey(fieldKey: string): boolean {
  return (ESSENTIAL_TEMPLATE_FIELD_KEYS as readonly string[]).includes(fieldKey);
}
