import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";

export type ScopeNavView = {
  id: string;
  label: string;
};

export const DOCUMENTS_SCOPE_NAV_VIEW: ScopeNavView = {
  id: "documents",
  label: "Documents",
};

/** Top-level scope views that have a shipped UI surface. */
export function servableScopeNavViews(enabledViews: string[] = []): ScopeNavView[] {
  const additional = ADDITIONAL_SCOPE_VIEW_CATALOG.filter(
    (view) => view.status === "available" && enabledViews.includes(view.id),
  ).map((view) => ({ id: view.id, label: view.label }));

  return [DOCUMENTS_SCOPE_NAV_VIEW, ...additional];
}

export function scopeNavViewLabel(viewId: string): string {
  if (viewId === DOCUMENTS_SCOPE_NAV_VIEW.id) {
    return DOCUMENTS_SCOPE_NAV_VIEW.label;
  }
  return (
    ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === viewId)?.label ?? viewId
  );
}
