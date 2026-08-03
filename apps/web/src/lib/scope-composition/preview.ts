import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";
import type { ScopeCompositionOutcome } from "@rhodes/shared/scope-composition";

/** Nav views every scope ships with — shown in preview/summary, not under the scope name. */
export const DEFAULT_SCOPE_VIEW_LABELS = ["Documents", "Library"] as const;

export function additionalScopeViewLabel(viewId: string): string {
  return (
    ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === viewId)?.label ?? viewId
  );
}

/** Additional views that are selectable and shippable today (excludes coming_soon). */
export function availableAdditionalScopeViewLabels(enabledViewIds: string[]): string[] {
  return enabledViewIds
    .filter((id) => {
      const definition = ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === id);
      return definition?.status === "available";
    })
    .map(additionalScopeViewLabel);
}

/** Full view list for wizard preview and summary. */
export function scopePreviewViewLabels(resolved: ScopeCompositionOutcome): string[] {
  const additional =
    resolved.ok && resolved.enabledViews.length > 0
      ? availableAdditionalScopeViewLabels(resolved.enabledViews)
      : [];

  return [...DEFAULT_SCOPE_VIEW_LABELS, ...additional];
}
