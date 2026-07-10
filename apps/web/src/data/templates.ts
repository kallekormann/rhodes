export type TemplateProperty = {
  label: string;
  value: string;
};

export type Template = {
  id: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  useCases: string[];
  properties?: TemplateProperty[];
  mine?: boolean;
};

export const templates: Template[] = [
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    shortDescription: "Capture decisions, owners, and follow-ups.",
    fullDescription:
      "Structured notes for recurring meetings with sections for attendees, agenda, decisions, and action items. Optimized for quick capture during calls.",
    useCases: ["Team syncs", "Client calls", "Sprint planning"],
    properties: [
      { label: "Status", value: "Draft" },
      { label: "Tags", value: "meeting" },
      { label: "Due", value: "—" },
    ],
    mine: true,
  },
  {
    id: "product-spec",
    name: "Product Spec",
    shortDescription: "Scope, objectives, and success metrics.",
    fullDescription:
      "A product specification template with objective, scope, requirements, metrics, and rollout plan. Connects naturally to experiment and library sources.",
    useCases: ["Feature specs", "Quarterly planning", "PRD drafts"],
    properties: [
      { label: "Status", value: "In progress" },
      { label: "Tags", value: "feature, q3" },
      { label: "Due", value: "Nov 10" },
    ],
  },
  {
    id: "experiment-log",
    name: "Experiment Log",
    shortDescription: "Hypothesis, setup, results, and learnings.",
    fullDescription:
      "Document growth and product experiments end-to-end: hypothesis, variant, sample size, outcome, and next steps for the team second brain.",
    useCases: ["A/B tests", "Growth experiments", "Research spikes"],
    properties: [
      { label: "Status", value: "Draft" },
      { label: "Tags", value: "experiment" },
    ],
    mine: true,
  },
  {
    id: "weekly-review",
    name: "Weekly Review",
    shortDescription: "Reflect on progress and set priorities.",
    fullDescription:
      "Personal and team weekly review with wins, blockers, priorities, and links to related documents in your workspace.",
    useCases: ["Personal planning", "Manager check-ins", "Team retros"],
  },
  {
    id: "research-brief",
    name: "Research Brief",
    shortDescription: "Question, sources, findings, and recommendations.",
    fullDescription:
      "Summarize qualitative or quantitative research with source links from your library, key findings, and recommended actions.",
    useCases: ["User research", "Market scans", "Competitive analysis"],
    properties: [
      { label: "Status", value: "Draft" },
      { label: "Tags", value: "research" },
    ],
  },
];

export const overviewTemplates = templates.slice(0, 3);
