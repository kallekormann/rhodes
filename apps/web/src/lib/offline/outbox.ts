/**
 * Document mutation outbox — coalesce one pending PATCH per document.
 */

import { getOfflineDB, type OfflineOutboxRecord } from "@/lib/offline/db";

export type DocumentPatchPayload = {
  title?: string;
  content?: Record<string, unknown>;
  content_plain?: string;
  metadata?: Record<string, unknown>;
};

export async function listOutbox(): Promise<OfflineOutboxRecord[]> {
  const db = await getOfflineDB();
  const rows = await db.getAll("outbox");
  return rows.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export async function getOutboxForDocument(
  documentId: string,
): Promise<OfflineOutboxRecord[]> {
  const db = await getOfflineDB();
  return db.getAllFromIndex("outbox", "by-document", documentId);
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
  const existing = await db.getAllFromIndex("outbox", "by-document", documentId);
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
    await db.add("outbox", record);
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

  await db.put("outbox", {
    ...primary,
    payload: mergedPayload,
    expected_updated_at: primary.expected_updated_at || expectedUpdatedAt,
  });

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
