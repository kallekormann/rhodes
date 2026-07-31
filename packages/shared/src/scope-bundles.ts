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
 * M2.5.0 ships the type system and an empty catalog; pilot bundles land in M2.5.3–4.
 */
export const BUNDLE_CATALOG: readonly BundleDefinition[] = [];

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
