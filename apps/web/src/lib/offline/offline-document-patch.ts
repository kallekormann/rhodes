/**
 * Atomic offline writes for title/metadata patches — documents cache + outbox
 * must stay in sync.
 *
 * Encrypt/async work must finish BEFORE opening the IDB transaction. Awaiting
 * crypto between `put` and `add` lets the transaction auto-commit early.
 */

import {
  documentToStorageRecord,
  type OfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { getOfflineDB, type OfflineOutboxStorageRecord } from "@/lib/offline/db";
import {
  getOutboxForDocument,
  outboxToStorageRecord,
  type DocumentPatchPayload,
} from "@/lib/offline/outbox";

type OutboxTxPlan =
  | { kind: "add"; record: OfflineOutboxStorageRecord }
  | {
      kind: "merge";
      record: OfflineOutboxStorageRecord;
      deleteIds: number[];
    };

export async function commitOfflineDocumentPatch(params: {
  document: OfflineDocumentRecord;
  patch: DocumentPatchPayload;
  expectedUpdatedAt: string;
}): Promise<void> {
  const { document, patch, expectedUpdatedAt } = params;
  const documentId = document.id;

  const docStorage = await documentToStorageRecord(document);
  const existing = await getOutboxForDocument(documentId);
  const pendingPatches = existing.filter((row) => row.mutation === "patch");

  let outboxPlan: OutboxTxPlan;
  if (pendingPatches.length === 0) {
    outboxPlan = {
      kind: "add",
      record: await outboxToStorageRecord({
        document_id: documentId,
        mutation: "patch",
        payload: { ...patch },
        expected_updated_at: expectedUpdatedAt,
        created_at: new Date().toISOString(),
        retries: 0,
      }),
    };
  } else {
    const [primary, ...rest] = pendingPatches.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const mergedPayload: DocumentPatchPayload = {
      ...(primary.payload as DocumentPatchPayload),
      ...patch,
    };
    outboxPlan = {
      kind: "merge",
      record: await outboxToStorageRecord({
        ...primary,
        payload: mergedPayload,
        expected_updated_at: primary.expected_updated_at || expectedUpdatedAt,
      }),
      deleteIds: rest
        .map((row) => row.id)
        .filter((id): id is number => id != null),
    };
  }

  const db = await getOfflineDB();
  const tx = db.transaction(["documents", "outbox"], "readwrite");
  const documentsStore = tx.objectStore("documents");
  const outboxStore = tx.objectStore("outbox");

  await documentsStore.put(docStorage);

  if (outboxPlan.kind === "add") {
    await outboxStore.add(outboxPlan.record);
  } else {
    await outboxStore.put(outboxPlan.record);
    for (const id of outboxPlan.deleteIds) {
      await outboxStore.delete(id);
    }
  }

  await tx.done;
}
