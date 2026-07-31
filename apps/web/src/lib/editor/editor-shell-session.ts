import { isClientHydrated } from "@/lib/client-hydration";

/**
 * Per-tab sticky flags for the document editor shell. Survives React Strict Mode
 * remounts and brief loading-state regressions within the same JS session.
 */
const revealedShellIds = new Set<string>();
const collabBootstrappedIds = new Set<string>();

const SHELL_SESSION_PREFIX = "rhodes:editor-shell:";
const TITLE_SESSION_PREFIX = "rhodes:doc-title:";

export function markEditorShellRevealed(shellKey: string): void {
  revealedShellIds.add(shellKey);
  try {
    sessionStorage.setItem(`${SHELL_SESSION_PREFIX}${shellKey}`, "1");
  } catch {
    /* private mode */
  }
}

export function isEditorShellRevealed(shellKey: string): boolean {
  // In-memory only — sessionStorage must not skip the body loader on hard refresh.
  return revealedShellIds.has(shellKey);
}

export function markCollabBootstrapped(documentId: string): void {
  collabBootstrappedIds.add(documentId);
}

export function isCollabBootstrapped(documentId: string): boolean {
  return collabBootstrappedIds.has(documentId);
}

export function cacheDocumentTitle(documentId: string, title: string): void {
  const trimmed = title.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(`${TITLE_SESSION_PREFIX}${documentId}`, trimmed);
  } catch {
    /* private mode */
  }
}

export function readCachedDocumentTitle(documentId: string): string | null {
  if (!isClientHydrated()) return null;
  try {
    return sessionStorage.getItem(`${TITLE_SESSION_PREFIX}${documentId}`);
  } catch {
    return null;
  }
}

export function clearEditorShellSession(shellKey?: string): void {
  if (!shellKey) {
    revealedShellIds.clear();
    collabBootstrappedIds.clear();
    return;
  }
  revealedShellIds.delete(shellKey);
  collabBootstrappedIds.delete(shellKey);
  try {
    sessionStorage.removeItem(`${SHELL_SESSION_PREFIX}${shellKey}`);
  } catch {
    /* private mode */
  }
}
