import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";
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
 * Full view list for wizard preview and summary — page types only.
 * Preset boards are tabs inside a page and are not listed here.
 */
export function scopePreviewViewLabels(
  resolved: ScopeCompositionOutcome,
): string[] {
  if (!resolved.ok) {
    return [...DEFAULT_SCOPE_VIEW_LABELS];
  }

  const additional = availableAdditionalScopeViewLabels(resolved.enabledViews);
  return [...DEFAULT_SCOPE_VIEW_LABELS, ...additional];
}
