/**
 * Document mutation outbox — coalesce one pending PATCH per document.
 * M1b.1: payload encrypted at rest via docs-vault.
 */

import { decryptDocsJson, encryptDocsJson } from "@/lib/offline/docs-vault";
import {
  getOfflineDB,
  type OfflineOutboxRecord,
  type OfflineOutboxStorageRecord,
} from "@/lib/offline/db";

export type DocumentCreatePayload = {
  workspace_id: string;
  title: string;
  template_id?: string;
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
  content_plain?: string;
};

export type DocumentPatchPayload = {
  title?: string;
  content?: Record<string, unknown>;
  content_plain?: string;
  metadata?: Record<string, unknown>;
};

async function toStorageRecord(
  record: OfflineOutboxRecord,
): Promise<OfflineOutboxStorageRecord> {
  const storage: OfflineOutboxStorageRecord = {
    document_id: record.document_id,
    mutation: record.mutation,
    payload_enc: await encryptDocsJson(record.payload),
    expected_updated_at: record.expected_updated_at,
    created_at: record.created_at,
    retries: record.retries,
  };
  // Omit id for new rows — explicit `id: undefined` breaks IDB autoIncrement keyPath.
  if (record.id != null) storage.id = record.id;
  return storage;
}

/** @internal used by offline-document-patch */
export async function outboxToStorageRecord(
  record: OfflineOutboxRecord,
): Promise<OfflineOutboxStorageRecord> {
  return toStorageRecord(record);
}

async function fromStorageRecord(
  row: OfflineOutboxStorageRecord,
): Promise<OfflineOutboxRecord> {
  return {
    id: row.id,
    document_id: row.document_id,
    mutation: row.mutation,
    payload: await decryptDocsJson<Record<string, unknown>>(row.payload_enc),
    expected_updated_at: row.expected_updated_at,
    created_at: row.created_at,
    retries: row.retries,
  };
}

export async function listOutbox(): Promise<OfflineOutboxRecord[]> {
  const db = await getOfflineDB();
  const rows = await db.getAll("outbox");
  const decrypted = await Promise.all(rows.map(fromStorageRecord));
  return decrypted.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export async function getOutboxEntry(
  id: number,
): Promise<OfflineOutboxRecord | null> {
  const db = await getOfflineDB();
  const row = await db.get("outbox", id);
  if (!row) return null;
  return fromStorageRecord(row);
}

export async function getOutboxForDocument(
  documentId: string,
): Promise<OfflineOutboxRecord[]> {
  const db = await getOfflineDB();
  const rows = await db.getAllFromIndex("outbox", "by-document", documentId);
  return Promise.all(rows.map(fromStorageRecord));
}

/**
 * Enqueue or merge a PATCH for a document. Keeps the earliest expected_updated_at
 * (server base when the pending edit chain started).
 */
export async function enqueueDocumentPatch(params: {
  documentId: string;
  patch: DocumentPatchPayload;
  expectedUpdatedAt: string;
}): Promise<void> {
  const { documentId, patch, expectedUpdatedAt } = params;
  const db = await getOfflineDB();
  const existing = await getOutboxForDocument(documentId);
  const pendingPatches = existing.filter((row) => row.mutation === "patch");

  if (pendingPatches.length === 0) {
    const record: OfflineOutboxRecord = {
      document_id: documentId,
      mutation: "patch",
      payload: { ...patch },
      expected_updated_at: expectedUpdatedAt,
      created_at: new Date().toISOString(),
      retries: 0,
    };
    await db.add("outbox", await toStorageRecord(record));
    return;
  }

  // Coalesce into the oldest row; delete extras.
  const [primary, ...rest] = pendingPatches.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const mergedPayload: DocumentPatchPayload = {
    ...(primary.payload as DocumentPatchPayload),
    ...patch,
  };

  await db.put(
    "outbox",
    await toStorageRecord({
      ...primary,
      payload: mergedPayload,
      expected_updated_at: primary.expected_updated_at || expectedUpdatedAt,
    }),
  );

  for (const row of rest) {
    if (row.id != null) await db.delete("outbox", row.id);
  }
}

export async function removeOutboxEntry(id: number): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("outbox", id);
}

export async function clearOutboxForDocument(documentId: string): Promise<void> {
  const db = await getOfflineDB();
  const rows = await db.getAllFromIndex("outbox", "by-document", documentId);
  await Promise.all(
    rows.map((row) => (row.id != null ? db.delete("outbox", row.id) : undefined)),
  );
}
