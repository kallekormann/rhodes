/**
 * Detect documents with unsent local changes (outbox, pending, local-only, or edited since server sync).
 */

import type { OfflineDocumentRecord } from "@/lib/offline/db";
import { listOfflineDocumentsForWorkspace } from "@/lib/offline/documents-cache";
import { isLocalOnlyDocument } from "@/lib/offline/local-document";
import { documentHasPendingOutbox } from "@/lib/offline/offline-sync-status";
import { getOutboxForDocument } from "@/lib/offline/outbox";

export function documentRecordHasUnsentWork(
  doc: OfflineDocumentRecord,
): boolean {
  if (isLocalOnlyDocument(doc)) return true;
  if (doc.sync_status === "pending" || doc.sync_status === "conflict") {
    return true;
  }
  const serverAt = doc.server_updated_at || "";
  if (doc.sync_status === "synced" && doc.updated_at > serverAt) {
    return true;
  }
  return false;
}

export async function documentHasUnsentWork(
  documentId: string,
  workspaceId?: string | null,
): Promise<boolean> {
  if (await documentHasPendingOutbox(documentId)) return true;

  if (workspaceId) {
    const docs = await listOfflineDocumentsForWorkspace(workspaceId);
    const doc = docs.find((row) => row.id === documentId);
    if (doc && documentRecordHasUnsentWork(doc)) return true;
    return false;
  }

  const outbox = await getOutboxForDocument(documentId);
  return outbox.length > 0;
}

export function hasLocalEditsSinceServerSync(doc: {
  sync_status: string;
  updated_at: string;
  server_updated_at: string;
}): boolean {
  if (doc.sync_status !== "synced") return false;
  const serverAt = doc.server_updated_at || "";
  return doc.updated_at > serverAt;
}
