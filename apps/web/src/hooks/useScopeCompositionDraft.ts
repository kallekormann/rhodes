"use client";

import { useCallback, useMemo, useState } from "react";
import { BUNDLE_CATALOG } from "@rhodes/shared/scope-bundles";
import {
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
): ScopeCompositionDraft {
  const viewPresetIds = Array.isArray(setupConfig?.viewPresetIds)
    ? setupConfig.viewPresetIds.filter((id): id is string => typeof id === "string")
    : [];
  const baseViewIds = Array.isArray(setupConfig?.baseViewIds)
    ? setupConfig.baseViewIds.filter((id): id is string => typeof id === "string")
    : [];
  const templateSlugs = Array.isArray(setupConfig?.templateSlugs)
    ? setupConfig.templateSlugs.filter((slug): slug is string => typeof slug === "string")
    : [];

  return {
    selectedBaseViewIds: baseViewIds,
    selectedViewPresetIds: viewPresetIds,
    selectedTemplateSlugs: templateSlugs,
    selectedBundleIds: bundleIds ?? [],
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

  const toggleBaseView = useCallback((viewId: string) => {
    setDraft((current) => ({
      ...current,
      selectedBaseViewIds: toggleInList(current.selectedBaseViewIds, viewId),
    }));
  }, [toggleInList]);

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
