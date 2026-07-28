/** Lets the sync engine flush debounced editor saves before draining the outbox. */

import { awaitPendingDocumentSaves } from "@/lib/offline/pending-document-saves";
import { flushRhodesYjsPersistence } from "@/lib/offline/yjs-rhodes-persistence";

let flushEditorSaves: (() => void) | null = null;

export function registerEditorSaveFlush(fn: () => void): () => void {
  flushEditorSaves = fn;
  return () => {
    if (flushEditorSaves === fn) flushEditorSaves = null;
  };
}

export function flushEditorSavesBeforeSync(): void {
  flushEditorSaves?.();
}

export async function flushEditorBeforeNavigation(
  documentId?: string | null,
): Promise<void> {
  flushEditorSavesBeforeSync();
  if (documentId) {
    await flushRhodesYjsPersistence(documentId);
  }
  await awaitPendingDocumentSaves();
}
