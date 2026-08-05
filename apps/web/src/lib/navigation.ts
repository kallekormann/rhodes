import type { AppView } from "@/context/AppContext";
import {
  isScopeEngineNavId,
  type ScopeEngineNavId,
} from "@/lib/scope-views/nav";

export const viewToPath: Record<AppView, string> = {
  editor: "/editor",
  documents: "/documents",
  kanban: "/kanban",
  dashboard: "/dashboard",
  calendar: "/calendar",
  gantt: "/gantt",
  mindmap: "/mindmap",
  graph: "/graph",
  wiki: "/wiki",
  templates: "/templates",
  library: "/library",
  settings: "/settings",
  "sticker-sheet": "/sticker-sheet",
};

export function pathToView(pathname: string): AppView {
  const normalized = pathname.replace(/\/$/, "") || "/";

  if (normalized === "/" || normalized === "/documents") return "documents";
  if (normalized === "/kanban") return "kanban";
  if (normalized === "/dashboard") return "dashboard";
  if (normalized === "/calendar") return "calendar";
  if (normalized === "/gantt") return "gantt";
  if (normalized === "/mindmap") return "mindmap";
  if (normalized === "/graph") return "graph";
  if (normalized === "/wiki") return "wiki";
  if (normalized === "/editor") return "editor";
  if (normalized === "/templates") return "templates";
  if (normalized === "/library") return "library";
  if (normalized === "/settings") return "settings";
  if (normalized === "/sticker-sheet") return "sticker-sheet";

  return "editor";
}

export function appViewToScopeNavId(view: AppView): string {
  if (view === "documents" || isScopeEngineNavId(view)) return view;
  return "documents";
}

export function scopeNavIdToAppView(viewId: string): AppView | null {
  if (viewId === "documents") return "documents";
  if (isScopeEngineNavId(viewId)) return viewId as ScopeEngineNavId;
  return null;
}
