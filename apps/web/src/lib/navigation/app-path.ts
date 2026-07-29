import type { AppView } from "@/context/AppContext";
import { pathToView, viewToPath } from "@/lib/navigation";

const APP_BASE = "/app";

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/** Full browser URL path including Next.js basePath (e.g. `/app/editor`). */
export function toAppUrl(path: string): string {
  if (path.startsWith(APP_BASE)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE}${normalized}`;
}

/** Read the active app view from `window.location` (popstate / pushState). */
export function viewFromBrowserLocation(): AppView {
  if (typeof window === "undefined") return "documents";
  const withoutBase =
    window.location.pathname.replace(new RegExp(`^${APP_BASE}`), "") || "/";
  return pathToView(withoutBase);
}

export function readDocIdFromBrowserLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("doc");
}

export function pushAppHistory(path: string): void {
  window.history.pushState(null, "", toAppUrl(path));
}

/** Synchronous URL update — survives HMR/remount before Next router finishes. */
export function replaceAppHistory(path: string): void {
  window.history.replaceState(null, "", toAppUrl(path));
}

export function buildEditorPath(docId?: string, templateId?: string): string {
  const base = viewToPath.editor;
  if (templateId) {
    return `${base}?template=${encodeURIComponent(templateId)}`;
  }
  if (docId) {
    return `${base}?doc=${encodeURIComponent(docId)}`;
  }
  return base;
}
