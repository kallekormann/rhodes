"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useApp, type AppView } from "@/context/AppContext";
import { pathToView } from "@/lib/navigation";
import { isBrowserOffline } from "@/lib/navigation/app-path";
import { LoaderState } from "@/components/Loader";
import { DocumentsListView } from "@/views/DocumentsListView";

const viewLoading = (label: string) => (
  <LoaderState label={label} align="fill" />
);

/** Engines only — documents list is imported statically to avoid Suspense/hydration drift. */
const ScopeEnginesView = dynamic(
  () => import("@/views/DocumentsView").then((m) => ({ default: m.DocumentsView })),
  { loading: () => viewLoading("Loading…"), ssr: false },
);
const EditorView = dynamic(
  () => import("@/views/EditorView").then((m) => ({ default: m.EditorView })),
  { loading: () => viewLoading("Opening editor…"), ssr: false },
);
const LibraryView = dynamic(
  () => import("@/views/LibraryView").then((m) => ({ default: m.LibraryView })),
  { loading: () => viewLoading("Loading library…"), ssr: false },
);
const SettingsView = dynamic(
  () => import("@/views/SettingsView").then((m) => ({ default: m.SettingsView })),
  { loading: () => viewLoading("Loading settings…"), ssr: false },
);
const StickerSheetView = dynamic(
  () =>
    import("@/views/StickerSheetView").then((m) => ({
      default: m.StickerSheetView,
    })),
  { loading: () => viewLoading("Loading…"), ssr: false },
);
const TemplatesView = dynamic(
  () =>
    import("@/views/TemplatesView").then((m) => ({ default: m.TemplatesView })),
  { loading: () => viewLoading("Loading templates…"), ssr: false },
);

function renderAppView(view: AppView) {
  switch (view) {
    case "editor":
      return <EditorView />;
    case "documents":
      return <DocumentsListView />;
    case "kanban":
    case "dashboard":
    case "calendar":
    case "gantt":
    case "mindmap":
    case "graph":
    case "wiki":
      return <ScopeEnginesView />;
    case "templates":
      return <TemplatesView />;
    case "library":
      return <LibraryView />;
    case "settings":
      return <SettingsView />;
    case "sticker-sheet":
      return <StickerSheetView />;
  }
}

/**
 * When offline navigation uses pushState instead of Next.js router, the browser
 * URL (and sometimes `usePathname`) updates without swapping the route segment.
 * Always render from AppContext `view` while offline.
 */
export function AppViewSwitch({ children }: { children: ReactNode }) {
  const { view } = useApp();
  const pathname = usePathname();
  const routeView = pathToView(pathname);

  if (isBrowserOffline()) {
    return renderAppView(view);
  }

  if (view === routeView) {
    return <>{children}</>;
  }

  // Leaving the editor: view updates before router.replace — show the target
  // view immediately so header navigation feels instant.
  if (view !== "editor" && routeView === "editor") {
    return renderAppView(view);
  }

  // Opening the editor: keep the current Next route until /editor is active so
  // we never mount EditorView twice (switch + page).
  return <>{children}</>;
}
