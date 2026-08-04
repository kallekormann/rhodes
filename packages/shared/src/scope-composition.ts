import type { BillingTier } from "./tiers";
import {
  type BundleDefinition,
  type MetadataFieldSeed,
  BUNDLE_CATALOG,
  bundleAllowedForTier,
} from "./scope-bundles";
import {
  type ViewTemplateAffinityMap,
  getRecommendedTemplatesForView,
} from "./view-template-affinity";
import {
  ADDITIONAL_SCOPE_VIEW_CATALOG,
  validateScopeCompositionViewSelection,
} from "./scope-views";
import type { ViewPreset } from "./scope-bundles";
import { getViewPresetById } from "./scope-bundles";

export type ScopeCompositionInput = {
  selectedViewPresetIds: string[];
  selectedBaseViewIds: string[];
  selectedTemplateSlugs: string[];
  selectedBundleIds: string[];
  tier: BillingTier;
};

export type ScopeSetupConfig = {
  viewPresetIds: string[];
  baseViewIds: string[];
  templateSlugs: string[];
  featuredTemplateSlugs: string[];
  bundleIds: string[];
  wizardMode?: string;
  appliedAt?: string;
  compositionSource?: "wizard" | "settings" | "api";
};

export type ScopeCompositionInferred = {
  addedTemplates: string[];
  addedViews: string[];
  addedPresets: string[];
};

export type ScopeCompositionResult = {
  ok: true;
  enabledViews: string[];
  viewPresetIds: string[];
  templateSlugs: string[];
  metadataFields: MetadataFieldSeed[];
  bundleIds: string[];
  setupConfig: ScopeSetupConfig;
  inferred: ScopeCompositionInferred;
};

export type ScopeCompositionError = {
  ok: false;
  reason: string;
};

export type ScopeCompositionOutcome = ScopeCompositionResult | ScopeCompositionError;

export type ResolveScopeCompositionOptions = {
  bundles?: readonly BundleDefinition[];
  affinity?: ViewTemplateAffinityMap;
};

function uniqueOrdered(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function collectPresetsFromBundles(
  bundles: BundleDefinition[],
): { presets: ViewPreset[]; presetIds: string[] } {
  const presets: ViewPreset[] = [];
  const presetIds: string[] = [];
  const seen = new Set<string>();
  for (const bundle of bundles) {
    for (const preset of bundle.viewPresets) {
      if (seen.has(preset.id)) continue;
      seen.add(preset.id);
      presets.push(preset);
      presetIds.push(preset.id);
    }
  }
  return { presets, presetIds };
}

function resolvePresetBaseViews(
  presetIds: string[],
  bundles: readonly BundleDefinition[],
): string[] {
  const presetMap = new Map<string, ViewPreset>();
  for (const bundle of bundles) {
    for (const preset of bundle.viewPresets) {
      presetMap.set(preset.id, preset);
    }
  }
  return presetIds
    .map((id) => presetMap.get(id)?.baseViewType)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function mergeMetadataFields(
  bundles: BundleDefinition[],
): MetadataFieldSeed[] {
  const seen = new Set<string>();
  const fields: MetadataFieldSeed[] = [];
  for (const bundle of bundles) {
    for (const field of bundle.metadataFields) {
      if (seen.has(field.field_key)) continue;
      seen.add(field.field_key);
      fields.push(field);
    }
  }
  return fields;
}

/** Templates still required by remaining views and/or selected bundles. */
export function templatesRequiredByViewsAndBundles(
  viewIds: Iterable<string>,
  bundleIds: Iterable<string>,
  bundles: readonly BundleDefinition[] = BUNDLE_CATALOG,
): Set<string> {
  const required = new Set<string>();
  for (const viewId of viewIds) {
    for (const slug of getRecommendedTemplatesForView(viewId)) {
      required.add(slug);
    }
  }
  const bundleIdSet = new Set(
    [...bundleIds].map((id) => id.trim()).filter(Boolean),
  );
  for (const bundle of bundles) {
    if (!bundleIdSet.has(bundle.id)) continue;
    for (const slug of bundle.templateSlugs) {
      required.add(slug);
    }
  }
  return required;
}

/** Bundle labels that contribute a page type via their presets (for lock UI). */
export function bundlesLockingBaseView(
  viewId: string,
  bundleIds: Iterable<string>,
  bundles: readonly BundleDefinition[] = BUNDLE_CATALOG,
): BundleDefinition[] {
  const selected = new Set(
    [...bundleIds].map((id) => id.trim()).filter(Boolean),
  );
  return bundles.filter(
    (bundle) =>
      selected.has(bundle.id) &&
      bundle.viewPresets.some((preset) => preset.baseViewType === viewId),
  );
}

/**
 * Apply a page-type toggle to composition draft fields.
 * Enabling adds recommended templates; disabling drops that page type's orphan
 * presets and recommended templates that nothing else still needs.
 * Presets are bundle-owned — they are never listed as selectable views.
 */
export function applyBaseViewToggle(
  draft: {
    selectedBaseViewIds: string[];
    selectedViewPresetIds: string[];
    selectedTemplateSlugs: string[];
    selectedBundleIds: string[];
  },
  viewId: string,
  options: {
    currentlyEnabled: boolean;
    bundles?: readonly BundleDefinition[];
  },
): typeof draft {
  const bundles = options.bundles ?? BUNDLE_CATALOG;
  if (bundlesLockingBaseView(viewId, draft.selectedBundleIds, bundles).length > 0) {
    return draft;
  }

  if (!options.currentlyEnabled) {
    const recommended = getRecommendedTemplatesForView(viewId);
    return {
      ...draft,
      selectedBaseViewIds: uniqueOrdered([
        ...draft.selectedBaseViewIds,
        viewId,
      ]),
      selectedTemplateSlugs: uniqueOrdered([
        ...draft.selectedTemplateSlugs,
        ...recommended,
      ]),
    };
  }

  const remainingViews = draft.selectedBaseViewIds.filter((id) => id !== viewId);
  const remainingPresets = draft.selectedViewPresetIds.filter((presetId) => {
    const preset = getViewPresetById(presetId);
    return preset?.baseViewType !== viewId;
  });
  const stillRequired = templatesRequiredByViewsAndBundles(
    remainingViews,
    draft.selectedBundleIds,
    bundles,
  );
  // Also keep templates required by remaining presets' page types (legacy picks).
  for (const presetId of remainingPresets) {
    const preset = getViewPresetById(presetId);
    if (!preset) continue;
    for (const slug of getRecommendedTemplatesForView(preset.baseViewType)) {
      stillRequired.add(slug);
    }
  }
  const droppedRecommended = new Set(getRecommendedTemplatesForView(viewId));
  const remainingTemplates = draft.selectedTemplateSlugs.filter(
    (slug) => stillRequired.has(slug) || !droppedRecommended.has(slug),
  );

  return {
    ...draft,
    selectedBaseViewIds: remainingViews,
    selectedViewPresetIds: remainingPresets,
    selectedTemplateSlugs: remainingTemplates,
  };
}

/**
 * Merge user selections and bundles; views drive recommended templates.
 * Presets come from bundles (and legacy setup_config picks) — they are tabs on a
 * page type, not additional page types. Templates do not force-enable views.
 */
export function resolveScopeComposition(
  input: ScopeCompositionInput,
  options: ResolveScopeCompositionOptions = {},
): ScopeCompositionOutcome {
  const catalog = options.bundles ?? BUNDLE_CATALOG;

  const explicitBundles: BundleDefinition[] = [];
  const seenBundleIds = new Set<string>();
  for (const id of input.selectedBundleIds) {
    if (seenBundleIds.has(id)) continue;
    seenBundleIds.add(id);
    const bundle = catalog.find((entry) => entry.id === id);
    if (!bundle) {
      return { ok: false, reason: `Unknown bundle: ${id}` };
    }
    explicitBundles.push(bundle);
  }
  for (const bundle of explicitBundles) {
    if (!bundleAllowedForTier(bundle, input.tier)) {
      return {
        ok: false,
        reason: `Bundle "${bundle.label}" is not available on your plan.`,
      };
    }
  }

  const bundleTemplateSlugs = explicitBundles.flatMap((b) => b.templateSlugs);
  const bundlePresetIds = collectPresetsFromBundles(explicitBundles).presetIds;

  const explicitTemplateSlugs = uniqueOrdered([
    ...input.selectedTemplateSlugs,
    ...bundleTemplateSlugs,
  ]);
  const explicitViewPresetIds = uniqueOrdered([
    ...input.selectedViewPresetIds,
    ...bundlePresetIds,
  ]);

  // Page types: explicit picks + page types implied by presets/bundles (tabs).
  const explicitBaseViews = uniqueOrdered([
    ...input.selectedBaseViewIds,
    ...resolvePresetBaseViews(explicitViewPresetIds, catalog),
    ...explicitBundles.flatMap((b) =>
      b.viewPresets.map((preset) => preset.baseViewType),
    ),
  ]);

  const inferredTemplates = new Set<string>();
  const inferredViews = new Set<string>();
  const inferredPresets = new Set<string>();

  const templateSlugs = new Set(explicitTemplateSlugs);
  const enabledViews = new Set(explicitBaseViews);

  // Blank is always available — header + creates from this template.
  if (!templateSlugs.has("blank")) {
    templateSlugs.add("blank");
    inferredTemplates.add("blank");
  }

  // View → templates: auto-add recommended templates for each enabled page type.
  for (const viewId of enabledViews) {
    for (const slug of getRecommendedTemplatesForView(viewId)) {
      if (!templateSlugs.has(slug)) {
        templateSlugs.add(slug);
        inferredTemplates.add(slug);
      }
    }
  }

  // Page types implied only by presets (not explicit base picks) count as inferred
  // for UI messaging — they are not separately selectable "views".
  for (const viewId of resolvePresetBaseViews(explicitViewPresetIds, catalog)) {
    if (!input.selectedBaseViewIds.includes(viewId)) {
      inferredViews.add(viewId);
    }
  }

  const enabledViewsList = uniqueOrdered(enabledViews);
  const templateSlugsList = uniqueOrdered(templateSlugs);
  const viewPresetIdsList = uniqueOrdered(explicitViewPresetIds);
  const bundleIdsList = uniqueOrdered(input.selectedBundleIds);

  const viewsValidation = validateScopeCompositionViewSelection(
    input.tier,
    enabledViewsList,
  );
  if (!viewsValidation.ok) {
    return viewsValidation;
  }

  // Reject unknown base view ids early.
  for (const viewId of enabledViewsList) {
    const known = ADDITIONAL_SCOPE_VIEW_CATALOG.some((view) => view.id === viewId);
    if (!known) {
      return { ok: false, reason: `Unknown scope view: ${viewId}` };
    }
  }

  const metadataFields = mergeMetadataFields(explicitBundles);
  // Every scope gets Origin so documents can link to a parent/source document.
  if (!metadataFields.some((field) => field.field_key === "origin")) {
    metadataFields.unshift({
      field_key: "origin",
      field_label: "Origin",
      field_type: "relation",
      ai_fill_enabled: false,
    });
  }
  const setupConfig: ScopeSetupConfig = {
    // Persist explicit picks only — bundle presets/templates re-enter via bundle_ids.
    viewPresetIds: uniqueOrdered(input.selectedViewPresetIds),
    baseViewIds: uniqueOrdered(input.selectedBaseViewIds),
    templateSlugs: uniqueOrdered(input.selectedTemplateSlugs),
    featuredTemplateSlugs: templateSlugsList.slice(0, 6),
    bundleIds: bundleIdsList,
    compositionSource: "api",
  };

  return {
    ok: true,
    enabledViews: enabledViewsList,
    viewPresetIds: viewPresetIdsList,
    templateSlugs: templateSlugsList,
    metadataFields,
    bundleIds: bundleIdsList,
    setupConfig,
    inferred: {
      addedTemplates: uniqueOrdered(inferredTemplates),
      addedViews: uniqueOrdered(inferredViews),
      addedPresets: uniqueOrdered(inferredPresets),
    },
  };
}
