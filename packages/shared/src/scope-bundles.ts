import type { BillingTier } from "./tiers";
import type { AdditionalScopeViewId } from "./scope-views";

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
    | "checkbox";
  options?: string[] | null;
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

export const BUNDLE_CATALOG: readonly BundleDefinition[] = [
  WIZARD_STARTER_BUNDLE,
  KNOWLEDGE_BASE_OPS_BUNDLE,
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
