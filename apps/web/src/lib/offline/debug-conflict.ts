/** Opt-in conflict/collab debug logging — `localStorage.rhodes_debug_conflict = "1"`. */
export function isOfflineConflictDebugEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem("rhodes_debug_conflict") === "1";
  } catch {
    return false;
  }
}

export function offlineConflictLog(...args: unknown[]): void {
  if (!isOfflineConflictDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(...args);
}
