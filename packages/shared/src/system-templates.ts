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
  | "policy-document";

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
];

export function getSystemTemplateSeed(slug: string): SystemTemplateSeed | undefined {
  return SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
}

export function isEssentialTemplateFieldKey(fieldKey: string): boolean {
  return (ESSENTIAL_TEMPLATE_FIELD_KEYS as readonly string[]).includes(fieldKey);
}
