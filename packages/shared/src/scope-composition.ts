import type { BillingTier } from "./tiers";
import {
  type BundleDefinition,
  type MetadataFieldSeed,
  BUNDLE_CATALOG,
  bundleAllowedForTier,
} from "./scope-bundles";
import {
  type ViewTemplateAffinityMap,
  VIEW_TEMPLATE_AFFINITY,
  getRecommendedTemplatesForView,
  viewsSatisfiedByTemplates,
} from "./view-template-affinity";
import {
  ADDITIONAL_SCOPE_VIEW_CATALOG,
  validateScopeCompositionViewSelection,
} from "./scope-views";
import type { ViewPreset } from "./scope-bundles";

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

/**
 * Merge user selections and bundles; infer missing views/templates bidirectionally.
 * Pure function — safe to run client-side in the wizard and server-side on create.
 */
export function resolveScopeComposition(
  input: ScopeCompositionInput,
  options: ResolveScopeCompositionOptions = {},
): ScopeCompositionOutcome {
  const catalog = options.bundles ?? BUNDLE_CATALOG;
  const affinity = options.affinity ?? VIEW_TEMPLATE_AFFINITY;

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

  // View → templates: auto-add recommended templates for each selected view.
  for (const viewId of enabledViews) {
    for (const slug of getRecommendedTemplatesForView(viewId)) {
      if (!templateSlugs.has(slug)) {
        templateSlugs.add(slug);
        inferredTemplates.add(slug);
      }
    }
  }

  // Templates → views: enable views when template set satisfies minForView.
  for (const viewId of viewsSatisfiedByTemplates(templateSlugs, affinity)) {
    if (!enabledViews.has(viewId)) {
      enabledViews.add(viewId);
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
  const setupConfig: ScopeSetupConfig = {
    viewPresetIds: viewPresetIdsList,
    baseViewIds: uniqueOrdered(input.selectedBaseViewIds),
    templateSlugs: templateSlugsList,
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
