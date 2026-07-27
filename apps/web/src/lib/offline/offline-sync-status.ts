/**
 * Sync status helpers — keep documents.sync_status aligned with outbox rows.
 */

import { getOfflineDocument, setOfflineDocumentStatus } from "@/lib/offline/documents-cache";
import { getOutboxForDocument, listOutbox } from "@/lib/offline/outbox";

/** True when this document has a queued title/metadata patch. */
export async function documentHasPendingOutbox(
  documentId: string,
): Promise<boolean> {
  const rows = await getOutboxForDocument(documentId);
  return rows.some((row) => row.mutation === "patch");
}

/**
 * documents.sync_status was reset to synced while an outbox row still exists
 * (e.g. server refresh clobbered the cache). Restore pending so UI + drain agree.
 */
export async function repairPendingStatusFromOutbox(
  documentId?: string,
): Promise<string[]> {
  const repaired: string[] = [];
  const targetIds = documentId
    ? [documentId]
    : [
        ...new Set(
          (await listOutbox())
            .filter((row) => row.mutation === "patch")
            .map((row) => row.document_id),
        ),
      ];

  for (const id of targetIds) {
    if (!(await documentHasPendingOutbox(id))) continue;
    const row = await getOfflineDocument(id);
    if (!row || row.sync_status === "pending" || row.sync_status === "conflict") {
      continue;
    }
    await setOfflineDocumentStatus(id, "pending");
    repaired.push(id);
  }

  return repaired;
}
