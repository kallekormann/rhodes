import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";

export type ScopeNavView = {
  id: string;
  label: string;
};

export const DOCUMENTS_SCOPE_NAV_VIEW: ScopeNavView = {
  id: "documents",
  label: "Documents",
};

/** Optional engines that share the documents app chrome and have their own routes. */
export const SCOPE_ENGINE_NAV_IDS = [
  "kanban",
  "dashboard",
  "calendar",
  "gantt",
  "mindmap",
  "graph",
] as const;

export type ScopeEngineNavId = (typeof SCOPE_ENGINE_NAV_IDS)[number];

export function isScopeEngineNavId(id: string): id is ScopeEngineNavId {
  return (SCOPE_ENGINE_NAV_IDS as readonly string[]).includes(id);
}

/** Documents + enabled engines — surfaces that use ScopeViewNav. */
export function isScopeSurfaceNavId(id: string): boolean {
  return id === DOCUMENTS_SCOPE_NAV_VIEW.id || isScopeEngineNavId(id);
}

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
    ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === viewId)?.label ??
    viewId
  );
}

export function scopeEnginePath(viewId: ScopeEngineNavId): string {
  return `/${viewId}`;
}
