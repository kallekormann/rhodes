"use client";

import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { pathToView } from "@/lib/navigation";
import { isBrowserOffline } from "@/lib/navigation/app-path";

/** True when the editor chrome (overlay header) should be active. */
export function useEditorRouteActive(): boolean {
  const { view } = useApp();
  const pathname = usePathname();

  if (isBrowserOffline()) {
    return view === "editor";
  }

  const routeIsEditor = pathToView(pathname) === "editor";

  // User navigated away in AppContext before the URL caught up — drop editor chrome.
  if (view !== "editor") {
    return false;
  }

  return routeIsEditor;
}
