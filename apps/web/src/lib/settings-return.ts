const LAST_APP_PATH_KEY = "rhodes:last-app-path";

function normalizeAppPath(pathWithSearch: string): string | null {
  const trimmed = pathWithSearch.trim();
  if (!trimmed.startsWith("/")) return null;

  const pathOnly = trimmed.split("?")[0]?.replace(/\/$/, "") || "/";
  if (pathOnly === "/settings") return null;

  return trimmed;
}

/** Remember the latest in-app route so Settings can return the user there. */
export function rememberLastAppPath(pathWithSearch: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeAppPath(pathWithSearch);
  if (!normalized) return;

  try {
    sessionStorage.setItem(LAST_APP_PATH_KEY, normalized);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/** Path to restore when leaving Settings; defaults to documents. */
export function getSettingsReturnPath(fallback = "/documents"): string {
  if (typeof window === "undefined") return fallback;

  try {
    const stored = sessionStorage.getItem(LAST_APP_PATH_KEY);
    if (!stored) return fallback;
    return normalizeAppPath(stored) ?? fallback;
  } catch {
    return fallback;
  }
}
