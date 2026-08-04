import type { BillingTier } from "./tiers";
import { TIER_LIMITS } from "./tiers";

/** Lifecycle of a scope navigation view in product UI. */
export type ScopeViewStatus = "available" | "coming_soon";

/** Essential app surfaces — always enabled for every scope and tier. */
export type EssentialScopeViewId =
  | "documents"
  | "editor"
  | "templates"
  | "library"
  | "settings";

/** Optional scope modes — catalog populated in a future product session. */
export type AdditionalScopeViewId = string & { readonly __brand?: "AdditionalScopeViewId" };

export type ScopeViewDefinition = {
  id: string;
  label: string;
  description: string;
  status: ScopeViewStatus;
  /** Minimum subscription tier when selectable. */
  minTier?: BillingTier;
};

export const ESSENTIAL_SCOPE_VIEW_IDS = [
  "documents",
  "editor",
  "templates",
  "library",
  "settings",
] as const satisfies readonly EssentialScopeViewId[];

/**
 * Additional scope views (Gantt, Calendar, etc.) — M2 catalog seed; surfaces ship in M6.
 */
export const ADDITIONAL_SCOPE_VIEW_CATALOG: readonly ScopeViewDefinition[] = [
  {
    id: "kanban",
    label: "Kanban",
    description: "Task boards per project",
    status: "available",
    minTier: "basic",
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Deadlines and publishing schedule",
    status: "coming_soon",
    minTier: "basic",
  },
  {
    id: "gantt",
    label: "Gantt",
    description: "Long-form planning timelines",
    status: "coming_soon",
    minTier: "pro",
  },
  {
    id: "wiki",
    label: "Wiki / links",
    description: "Internal doc graph",
    status: "coming_soon",
    minTier: "basic",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Scope metrics and summaries",
    status: "coming_soon",
    minTier: "pro",
  },
  {
    id: "mindmap",
    label: "Mind-Map",
    description: "Author a map of documents; connections become relations",
    status: "coming_soon",
    minTier: "pro",
  },
  {
    id: "graph",
    label: "Knowledge Graph",
    description: "Explore relation-linked documents across the scope",
    status: "coming_soon",
    minTier: "pro",
  },
];

const TIER_RANK: Record<BillingTier, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  team: 3,
};

export function isEssentialScopeView(id: string): id is EssentialScopeViewId {
  return (ESSENTIAL_SCOPE_VIEW_IDS as readonly string[]).includes(id);
}

export function maxAdditionalScopeViewsForTier(tier: BillingTier): number {
  return TIER_LIMITS[tier].maxAdditionalScopeViews;
}

export function additionalScopeViewAllowedForTier(
  view: ScopeViewDefinition,
  tier: BillingTier,
  requireAvailable = true,
): boolean {
  if (requireAvailable && view.status !== "available") return false;
  if (!view.minTier) return true;
  return TIER_RANK[tier] >= TIER_RANK[view.minTier];
}

export function validateAdditionalScopeViewSelection(
  tier: BillingTier,
  selectedIds: string[],
): { ok: true } | { ok: false; reason: string } {
  return validateScopeViewSelection(tier, selectedIds, { requireAvailable: true });
}

/**
 * Validates views persisted via scope composition (wizard / bundles).
 * Allows `coming_soon` catalog entries — user intent is stored until M6 surfaces ship.
 */
export function validateScopeCompositionViewSelection(
  tier: BillingTier,
  selectedIds: string[],
): { ok: true } | { ok: false; reason: string } {
  return validateScopeViewSelection(tier, selectedIds, { requireAvailable: false });
}

function validateScopeViewSelection(
  tier: BillingTier,
  selectedIds: string[],
  options: { requireAvailable: boolean },
): { ok: true } | { ok: false; reason: string } {
  const max = maxAdditionalScopeViewsForTier(tier);
  if (selectedIds.length > max) {
    return {
      ok: false,
      reason: `Your plan allows up to ${max} additional scope view${max === 1 ? "" : "s"}.`,
    };
  }

  for (const id of selectedIds) {
    if (isEssentialScopeView(id)) {
      return { ok: false, reason: `"${id}" is always enabled and cannot be toggled.` };
    }
    const definition = ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === id);
    if (!definition) {
      return { ok: false, reason: `Unknown scope view: ${id}` };
    }
    if (options.requireAvailable && definition.status !== "available") {
      return {
        ok: false,
        reason: `"${definition.label}" is not available yet.`,
      };
    }
    if (!additionalScopeViewAllowedForTier(definition, tier, options.requireAvailable)) {
      return { ok: false, reason: `"${definition.label}" requires a higher plan.` };
    }
  }

  return { ok: true };
}
