"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useApp, type AppView } from "@/context/AppContext";
import { pathToView } from "@/lib/navigation";
import { isBrowserOffline } from "@/lib/navigation/app-path";
import { DocumentsView } from "@/views/DocumentsView";
import { EditorView } from "@/views/EditorView";
import { LibraryView } from "@/views/LibraryView";
import { SettingsView } from "@/views/SettingsView";
import { StickerSheetView } from "@/views/StickerSheetView";
import { TemplatesView } from "@/views/TemplatesView";

function renderAppView(view: AppView) {
  switch (view) {
    case "editor":
      return <EditorView />;
    case "documents":
      return <DocumentsView />;
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

  if (view !== routeView) {
    return renderAppView(view);
  }

  return <>{children}</>;
}
