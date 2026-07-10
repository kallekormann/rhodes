const LAST_DOC_PREFIX = "rhodes:last_doc:";

export function lastDocumentKey(workspaceId: string) {
  return `${LAST_DOC_PREFIX}${workspaceId}`;
}

export function readLastDocumentId(workspaceId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(lastDocumentKey(workspaceId));
}

export function writeLastDocumentId(workspaceId: string, documentId: string) {
  window.localStorage.setItem(lastDocumentKey(workspaceId), documentId);
}
