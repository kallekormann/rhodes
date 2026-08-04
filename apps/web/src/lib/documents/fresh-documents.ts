/**
 * Documents created in this browser session skip Activity/Versions fetches
 * until the next cold open (reload / reopen from another surface).
 */
const freshDocumentIds = new Set<string>();

export function markDocumentFresh(documentId: string): void {
  if (documentId) freshDocumentIds.add(documentId);
}

export function isDocumentFresh(documentId: string | null | undefined): boolean {
  if (!documentId) return false;
  return freshDocumentIds.has(documentId);
}

/** Optional: clear when history becomes relevant (e.g. user opens Versions later). */
export function clearDocumentFresh(documentId: string): void {
  freshDocumentIds.delete(documentId);
}
