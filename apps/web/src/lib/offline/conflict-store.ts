/**
 * Persist / clear server ("theirs") snapshot during a sync conflict.
 */

import { getOfflineDB } from "@/lib/offline/db";
import type { DocumentRecord } from "@/hooks/useDocument";

function conflictMetaKey(documentId: string) {
  return `conflict_server:${documentId}`;
}

export async function storeConflictServerDocument(
  documentId: string,
  document: DocumentRecord | Record<string, unknown>,
): Promise<void> {
  const db = await getOfflineDB();
  await db.put("meta", document, conflictMetaKey(documentId));
}

export async function loadConflictServerDocument(
  documentId: string,
): Promise<DocumentRecord | null> {
  const db = await getOfflineDB();
  const value = await db.get("meta", conflictMetaKey(documentId));
  if (!value || typeof value !== "object") return null;
  const record = value as DocumentRecord;
  if (typeof record.id !== "string" || typeof record.updated_at !== "string") {
    return null;
  }
  return record;
}

export async function clearConflictServerDocument(
  documentId: string,
): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("meta", conflictMetaKey(documentId));
}
