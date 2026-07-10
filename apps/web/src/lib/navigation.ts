import type { AppView } from "@/context/AppContext";

export const viewToPath: Record<AppView, string> = {
  editor: "/editor",
  documents: "/documents",
  templates: "/templates",
  library: "/library",
  settings: "/settings",
  "sticker-sheet": "/sticker-sheet",
};

export function pathToView(pathname: string): AppView {
  const normalized = pathname.replace(/\/$/, "") || "/";

  if (normalized === "/" || normalized === "/editor") return "editor";
  if (normalized === "/documents") return "documents";
  if (normalized === "/templates") return "templates";
  if (normalized === "/library") return "library";
  if (normalized === "/settings") return "settings";
  if (normalized === "/sticker-sheet") return "sticker-sheet";

  return "editor";
}
