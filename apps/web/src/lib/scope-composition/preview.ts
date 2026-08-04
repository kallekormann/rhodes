import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";
import { getViewPresetsByIds } from "@rhodes/shared/scope-bundles";
import type { ScopeCompositionOutcome } from "@rhodes/shared/scope-composition";

/** Nav views every scope ships with — shown in preview/summary, not under the scope name. */
export const DEFAULT_SCOPE_VIEW_LABELS = ["Documents", "Library"] as const;

export function additionalScopeViewLabel(viewId: string): string {
  return (
    ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === viewId)?.label ??
    viewId
  );
}

/** Additional views that are selectable and shippable today (excludes coming_soon). */
export function availableAdditionalScopeViewLabels(
  enabledViewIds: string[],
): string[] {
  return enabledViewIds
    .filter((id) => {
      const definition = ADDITIONAL_SCOPE_VIEW_CATALOG.find(
        (view) => view.id === id,
      );
      return definition?.status === "available";
    })
    .map(additionalScopeViewLabel);
}

/**
 * Full view list for wizard preview and summary.
 * Page types with multiple preset boards show as "Kanban (2 boards)".
 */
export function scopePreviewViewLabels(
  resolved: ScopeCompositionOutcome,
): string[] {
  if (!resolved.ok) {
    return [...DEFAULT_SCOPE_VIEW_LABELS];
  }

  const presets = getViewPresetsByIds(resolved.viewPresetIds);
  const additional = resolved.enabledViews
    .filter((id) => {
      const definition = ADDITIONAL_SCOPE_VIEW_CATALOG.find(
        (view) => view.id === id,
      );
      return definition?.status === "available";
    })
    .map((viewId) => {
      const label = additionalScopeViewLabel(viewId);
      const boardCount = presets.filter(
        (preset) => preset.baseViewType === viewId,
      ).length;
      if (boardCount > 1) return `${label} (${boardCount} boards)`;
      if (boardCount === 1) return `${label} (1 board)`;
      return label;
    });

  return [...DEFAULT_SCOPE_VIEW_LABELS, ...additional];
}
