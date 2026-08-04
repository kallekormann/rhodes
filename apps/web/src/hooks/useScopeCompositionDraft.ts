"use client";

import { useCallback, useMemo, useState } from "react";
import { BUNDLE_CATALOG, getBundlesByIds } from "@rhodes/shared/scope-bundles";
import {
  applyBaseViewToggle,
  resolveScopeComposition,
  type ScopeCompositionOutcome,
} from "@rhodes/shared/scope-composition";
import { maxAdditionalScopeViewsForTier } from "@rhodes/shared/scope-views";
import type { BillingTier } from "@rhodes/shared/tiers";
import type { ScopeCompositionBody } from "@/lib/scope-composition/apply";

export type ScopeCompositionDraft = {
  selectedBaseViewIds: string[];
  selectedViewPresetIds: string[];
  selectedTemplateSlugs: string[];
  selectedBundleIds: string[];
};

export const EMPTY_SCOPE_COMPOSITION_DRAFT: ScopeCompositionDraft = {
  selectedBaseViewIds: [],
  selectedViewPresetIds: [],
  selectedTemplateSlugs: [],
  selectedBundleIds: [],
};

export function draftFromSetupConfig(
  setupConfig: Record<string, unknown> | null | undefined,
  bundleIds: string[] | null | undefined,
  enabledViews?: string[] | null,
): ScopeCompositionDraft {
  const selectedBundleIds = bundleIds ?? [];
  const selectedBundles = getBundlesByIds(selectedBundleIds);
  const bundlePresetIds = new Set(
    selectedBundles.flatMap((bundle) =>
      bundle.viewPresets.map((preset) => preset.id),
    ),
  );
  const bundleTemplateSlugs = new Set(
    selectedBundles.flatMap((bundle) => bundle.templateSlugs),
  );
  const bundleViewIds = new Set(
    selectedBundles.flatMap((bundle) =>
      bundle.viewPresets.map((preset) => preset.baseViewType),
    ),
  );

  const viewPresetIds = Array.isArray(setupConfig?.viewPresetIds)
    ? setupConfig.viewPresetIds.filter(
        (id): id is string =>
          typeof id === "string" && !bundlePresetIds.has(id),
      )
    : [];

  const hasStoredBaseViews = Array.isArray(setupConfig?.baseViewIds);
  let baseViewIds = hasStoredBaseViews
    ? (setupConfig!.baseViewIds as unknown[]).filter(
        (id): id is string => typeof id === "string",
      )
    : [];
  // Legacy scopes may only have workspaces.enabled_views — hydrate explicit picks
  // from that list (excluding page types that come solely from selected bundles).
  if (!hasStoredBaseViews && Array.isArray(enabledViews)) {
    baseViewIds = enabledViews.filter(
      (id): id is string => typeof id === "string" && !bundleViewIds.has(id),
    );
  }

  // Keep view-recommended / user picks; bundle templates re-enter via resolve.
  const templateSlugs = Array.isArray(setupConfig?.templateSlugs)
    ? setupConfig.templateSlugs.filter(
        (slug): slug is string =>
          typeof slug === "string" && !bundleTemplateSlugs.has(slug),
      )
    : [];

  return {
    selectedBaseViewIds: baseViewIds,
    selectedViewPresetIds: viewPresetIds,
    selectedTemplateSlugs: templateSlugs,
    selectedBundleIds,
  };
}

export function draftToCompositionBody(draft: ScopeCompositionDraft): ScopeCompositionBody {
  return {
    selected_base_view_ids: draft.selectedBaseViewIds,
    selected_view_preset_ids: draft.selectedViewPresetIds,
    selected_template_slugs: draft.selectedTemplateSlugs,
    selected_bundle_ids: draft.selectedBundleIds,
  };
}

type UseScopeCompositionDraftOptions = {
  tier: BillingTier;
  initial?: Partial<ScopeCompositionDraft>;
};

export function useScopeCompositionDraft({
  tier,
  initial,
}: UseScopeCompositionDraftOptions) {
  const [draft, setDraft] = useState<ScopeCompositionDraft>(() => ({
    ...EMPTY_SCOPE_COMPOSITION_DRAFT,
    ...initial,
  }));

  const resolved: ScopeCompositionOutcome = useMemo(
    () =>
      resolveScopeComposition(
        {
          selectedBaseViewIds: draft.selectedBaseViewIds,
          selectedViewPresetIds: draft.selectedViewPresetIds,
          selectedTemplateSlugs: draft.selectedTemplateSlugs,
          selectedBundleIds: draft.selectedBundleIds,
          tier,
        },
        { bundles: BUNDLE_CATALOG },
      ),
    [draft, tier],
  );

  const viewLimit = maxAdditionalScopeViewsForTier(tier);
  const viewCount =
    resolved.ok ? resolved.enabledViews.length : draft.selectedBaseViewIds.length;

  const toggleInList = useCallback((list: string[], id: string): string[] => {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }, []);

  const toggleBaseView = useCallback(
    (viewId: string) => {
      setDraft((current) => {
        const currentResolved = resolveScopeComposition(
          {
            selectedBaseViewIds: current.selectedBaseViewIds,
            selectedViewPresetIds: current.selectedViewPresetIds,
            selectedTemplateSlugs: current.selectedTemplateSlugs,
            selectedBundleIds: current.selectedBundleIds,
            tier,
          },
          { bundles: BUNDLE_CATALOG },
        );
        const currentlyEnabled =
          currentResolved.ok && currentResolved.enabledViews.includes(viewId);

        return applyBaseViewToggle(current, viewId, {
          currentlyEnabled,
          bundles: BUNDLE_CATALOG,
        });
      });
    },
    [tier],
  );

  const toggleViewPreset = useCallback((presetId: string) => {
    setDraft((current) => ({
      ...current,
      selectedViewPresetIds: toggleInList(current.selectedViewPresetIds, presetId),
    }));
  }, [toggleInList]);

  const toggleTemplate = useCallback((slug: string) => {
    setDraft((current) => ({
      ...current,
      selectedTemplateSlugs: toggleInList(current.selectedTemplateSlugs, slug),
    }));
  }, [toggleInList]);

  const toggleBundle = useCallback((bundleId: string) => {
    setDraft((current) => ({
      ...current,
      selectedBundleIds: toggleInList(current.selectedBundleIds, bundleId),
    }));
  }, [toggleInList]);

  const resetDraft = useCallback((next?: Partial<ScopeCompositionDraft>) => {
    setDraft({ ...EMPTY_SCOPE_COMPOSITION_DRAFT, ...next });
  }, []);

  return {
    draft,
    resolved,
    viewLimit,
    viewCount,
    toggleBaseView,
    toggleViewPreset,
    toggleTemplate,
    toggleBundle,
    resetDraft,
    setDraft,
  };
}
