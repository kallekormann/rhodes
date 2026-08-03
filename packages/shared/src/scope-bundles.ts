import type { BillingTier } from "./tiers";
import type { AdditionalScopeViewId } from "./scope-views";

/** Workflow category a status option belongs to — mirrors apps/web's MetadataFieldSchema StatusCategory. */
export type StatusCategorySeed = "unstarted" | "started" | "completed" | "canceled";

export type StatusOptionSeed = {
  value: string;
  label: string;
  category: StatusCategorySeed;
};

/** Metadata field injected when a bundle or view preset is applied to a scope. */
export type MetadataFieldSeed = {
  field_key: string;
  field_label: string;
  field_type:
    | "text"
    | "textarea"
    | "select"
    | "multi_select"
    | "date"
    | "date_range"
    | "tags"
    | "number"
    | "url"
    | "checkbox"
    | "status"
    | "relation";
  options?: string[] | StatusOptionSeed[] | { unit: string } | null;
  ai_fill_enabled?: boolean;
};

/** Bundle-specific configured instance of a base scope view (ships in M6). */
export type ViewPreset = {
  id: string;
  baseViewType: AdditionalScopeViewId;
  label: string;
  description: string;
  config: Record<string, unknown>;
};

export type BundleStatus = "available" | "coming_soon";

/** Declarative bundle — convenience grouping over the view↔template affinity graph. */
export type BundleDefinition = {
  id: string;
  label: string;
  description: string;
  audience: string[];
  status: BundleStatus;
  minTier?: BillingTier;
  viewPresets: ViewPreset[];
  templateSlugs: string[];
  metadataFields: MetadataFieldSeed[];
};

/**
 * Bundle catalog — populated incrementally (M2.5.3+).
 * M2.5.1 ships one wizard test bundle for composition UI verification.
 */
export const WIZARD_STARTER_BUNDLE: BundleDefinition = {
  id: "wizard-starter",
  label: "Starter pack",
  description: "Wiki workflows and meeting templates to try scope composition.",
  audience: ["general"],
  status: "available",
  viewPresets: [
    {
      id: "wiki-starter",
      baseViewType: "wiki",
      label: "Doc graph",
      description: "Link pages into a lightweight knowledge base",
      config: { layout: "graph" },
    },
  ],
  templateSlugs: ["meeting-notes", "report"],
  metadataFields: [],
};

export const KNOWLEDGE_BASE_OPS_BUNDLE: BundleDefinition = {
  id: "knowledge-base-ops",
  label: "Knowledge Base & Operations",
  description: "SOPs, onboarding, and policy docs kept fresh with owners and review cycles.",
  audience: ["operations", "people-ops", "general"],
  status: "available",
  viewPresets: [
    {
      id: "kb-doc-graph",
      baseViewType: "wiki",
      label: "Doc graph",
      description: "Link SOPs, guides, and policies into a browsable knowledge base",
      config: { layout: "graph" },
    },
    {
      id: "kb-freshness-radar",
      baseViewType: "dashboard",
      label: "Freshness radar",
      description: "Surface docs that are overdue for review at a glance",
      config: { verification_status: true, review_cycle: true, last_audited: true },
    },
  ],
  templateSlugs: ["sop", "onboarding-guide", "policy-document"],
  metadataFields: [
    {
      field_key: "owner",
      field_label: "Owner",
      field_type: "text",
      ai_fill_enabled: true,
    },
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
  ],
};

export const GROWTH_EXPERIMENTATION_BUNDLE: BundleDefinition = {
  id: "growth-experimentation",
  label: "Growth & Experimentation",
  description: "Insights and problems flow into A/B experiments — tracked from idea to readout.",
  audience: ["growth", "product", "founders", "ab-testing"],
  status: "available",
  viewPresets: [
    {
      id: "growth-experiment-board",
      baseViewType: "kanban",
      label: "Experiment board",
      description: "Backlog → Design → Engineering → Live → Analyzing → Concluded",
      config: { groupBy: "experiment_status" },
    },
    {
      id: "growth-funnel-dashboard",
      baseViewType: "dashboard",
      label: "Funnel dashboard",
      description: "Experiments grouped by funnel stage (Acquisition → Revenue)",
      config: { groupBy: "funnel_stage" },
    },
  ],
  templateSlugs: ["ab-experiment", "insight", "problem", "scientific-experiment"],
  metadataFields: [
    {
      field_key: "funnel_stage",
      field_label: "Funnel stage",
      field_type: "select",
      options: ["acquisition", "activation", "retention", "referral", "revenue"],
      ai_fill_enabled: true,
    },
    {
      field_key: "origin",
      field_label: "Origin",
      field_type: "relation",
      ai_fill_enabled: false,
    },
  ],
};

export const PRODUCT_ARCHITECTURE_BUNDLE: BundleDefinition = {
  id: "product-architecture",
  label: "Product Architecture & Decisions",
  description: "ADRs, requirements docs, and workflow definitions with a decision log and traceable history.",
  audience: ["engineering", "cto", "developer", "startups", "product"],
  status: "available",
  viewPresets: [
    {
      id: "architecture-decision-log",
      baseViewType: "kanban",
      label: "Decision log",
      description: "Proposed → Accepted → Deprecated/Superseded",
      config: { groupBy: "decision_status" },
    },
    {
      id: "architecture-wiki",
      baseViewType: "wiki",
      label: "Architecture wiki",
      description: "Browse ADRs, requirements, and workflow definitions as a linked knowledge base",
      config: { layout: "graph" },
    },
  ],
  templateSlugs: ["adr", "technical-requirements-document", "workflow-definition"],
  metadataFields: [
    {
      field_key: "impact_area",
      field_label: "Impact area",
      field_type: "multi_select",
      options: ["frontend", "backend", "database", "infrastructure"],
      ai_fill_enabled: true,
    },
  ],
};

export const PRODUCT_DISCOVERY_UX_BUNDLE: BundleDefinition = {
  id: "product-discovery-ux",
  label: "Product Discovery & UX",
  description: "PRDs, feature specs, and user flows — from requirement to shipped feature.",
  audience: ["product", "ux-design", "ux-research", "founders", "startups"],
  status: "available",
  viewPresets: [
    {
      id: "product-feature-board",
      baseViewType: "kanban",
      label: "Feature board",
      description: "Idea → Planned → Building → Shipped",
      config: { groupBy: "feature_status" },
    },
    {
      id: "product-roadmap-gantt",
      baseViewType: "gantt",
      label: "Roadmap",
      description: "PRDs and features by target release",
      config: { groupBy: "target_release" },
    },
  ],
  templateSlugs: ["prd", "product-feature", "user-flow-definition", "swot-analysis"],
  metadataFields: [
    {
      field_key: "product_area",
      field_label: "Product area",
      field_type: "select",
      options: ["core_app", "browser_extension", "admin_panel", "api"],
      ai_fill_enabled: true,
    },
  ],
};

export const GTM_PROJECT_EXECUTION_BUNDLE: BundleDefinition = {
  id: "gtm-project-execution",
  label: "GTM & Project Execution",
  description: "Charters, GTM plans, and launch checklists — with a live status cadence.",
  audience: ["gtm", "project-manager", "founders", "startups", "marketing"],
  status: "available",
  viewPresets: [
    {
      id: "launch-timeline",
      baseViewType: "gantt",
      label: "Launch timeline",
      description: "Project charters and GTM plans by target launch date",
      config: { groupBy: "target_launch_date" },
    },
    {
      id: "status-dashboard",
      baseViewType: "dashboard",
      label: "Status dashboard",
      description: "Latest status reports grouped by health (on track / at risk / off track)",
      config: { groupBy: "health" },
    },
  ],
  templateSlugs: ["project-charter", "gtm-plan", "launch-checklist", "weekly-status"],
  metadataFields: [
    {
      field_key: "sponsor",
      field_label: "Sponsor",
      field_type: "text",
      ai_fill_enabled: true,
    },
  ],
};

export const CONTENT_MARKETING_BUNDLE: BundleDefinition = {
  id: "content-marketing",
  label: "Content & Campaign Marketing",
  description: "Campaign briefs, content calendar, SEO briefs, and social batches — all traceable to a campaign.",
  audience: ["content-marketing", "seo", "social-media", "marketing"],
  status: "available",
  viewPresets: [
    {
      id: "content-calendar",
      baseViewType: "calendar",
      label: "Content calendar",
      description: "Content pieces and social batches by publish/scheduled date",
      config: { dateField: "publish_date" },
    },
    {
      id: "content-pipeline-board",
      baseViewType: "kanban",
      label: "Content pipeline",
      description: "Idea → Drafting → Review → Scheduled → Published",
      config: { groupBy: "content_status" },
    },
  ],
  templateSlugs: ["campaign-brief", "editorial-calendar", "seo-brief", "social-post-batch"],
  metadataFields: [
    {
      field_key: "campaign",
      field_label: "Campaign",
      field_type: "relation",
      ai_fill_enabled: false,
    },
  ],
};

export const STRATEGY_CONSULTING_BUNDLE: BundleDefinition = {
  id: "strategy-consulting",
  label: "Strategy & Consulting",
  description: "Audits, business plans, and client letters — built for engagement-based work.",
  audience: ["consultants", "business-consultants", "digital-strategy-consultants", "analysts", "founders"],
  status: "available",
  viewPresets: [
    {
      id: "engagement-tracker",
      baseViewType: "dashboard",
      label: "Engagement tracker",
      description: "Audits and plans grouped by client and status",
      config: { groupBy: "client" },
    },
  ],
  templateSlugs: [
    "digital-maturity-audit",
    "general-audit",
    "business-plan",
    "professional-business-letter",
  ],
  metadataFields: [
    {
      field_key: "client",
      field_label: "Client",
      field_type: "text",
      ai_fill_enabled: true,
    },
  ],
};

export const BUNDLE_CATALOG: readonly BundleDefinition[] = [
  WIZARD_STARTER_BUNDLE,
  KNOWLEDGE_BASE_OPS_BUNDLE,
  GROWTH_EXPERIMENTATION_BUNDLE,
  PRODUCT_ARCHITECTURE_BUNDLE,
  PRODUCT_DISCOVERY_UX_BUNDLE,
  GTM_PROJECT_EXECUTION_BUNDLE,
  CONTENT_MARKETING_BUNDLE,
  STRATEGY_CONSULTING_BUNDLE,
];

export function getBundleById(bundleId: string): BundleDefinition | undefined {
  return BUNDLE_CATALOG.find((bundle) => bundle.id === bundleId);
}

export function getBundlesByIds(bundleIds: string[]): BundleDefinition[] {
  const seen = new Set<string>();
  const bundles: BundleDefinition[] = [];
  for (const id of bundleIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const bundle = getBundleById(id);
    if (bundle) bundles.push(bundle);
  }
  return bundles;
}

export function bundleAllowedForTier(
  bundle: BundleDefinition,
  tier: BillingTier,
): boolean {
  if (bundle.status !== "available") return false;
  if (!bundle.minTier) return true;
  const rank: Record<BillingTier, number> = {
    free: 0,
    basic: 1,
    pro: 2,
    team: 3,
  };
  return rank[tier] >= rank[bundle.minTier];
}
