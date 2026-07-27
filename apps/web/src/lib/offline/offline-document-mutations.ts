/**
 * Atomic offline create/delete and local-only updates (M1b.4).
 */

import {
  documentToStorageRecord,
  deleteOfflineDocument,
  getOfflineDocument,
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import {
  getOfflineDB,
  type OfflineDocumentRecord,
} from "@/lib/offline/db";
import { LOCAL_SERVER_UPDATED_AT, isLocalOnlyDocument } from "@/lib/offline/local-document";
import { purgeDocumentOfflineCache } from "@/lib/offline/offline-document-access-cache";
import { commitOfflineDocumentPatch } from "@/lib/offline/offline-document-patch";
import {
  getOutboxForDocument,
  outboxToStorageRecord,
  type DocumentCreatePayload,
  type DocumentPatchPayload,
} from "@/lib/offline/outbox";

export async function commitOfflineDocumentCreate(params: {
  document: OfflineDocumentRecord;
  create: DocumentCreatePayload;
}): Promise<void> {
  const docStorage = await documentToStorageRecord(params.document);
  const outboxRecord = await outboxToStorageRecord({
    document_id: params.document.id,
    mutation: "create",
    payload: { ...params.create },
    expected_updated_at: LOCAL_SERVER_UPDATED_AT,
    created_at: new Date().toISOString(),
    retries: 0,
  });

  const db = await getOfflineDB();
  const tx = db.transaction(["documents", "outbox"], "readwrite");
  await tx.objectStore("documents").put(docStorage);
  await tx.objectStore("outbox").add(outboxRecord);
  await tx.done;
}

export async function commitOfflineLocalDocumentUpdate(params: {
  document: OfflineDocumentRecord;
  patch: DocumentPatchPayload;
}): Promise<void> {
  const { document, patch } = params;
  const existing = await getOutboxForDocument(document.id);
  const createRows = existing.filter((row) => row.mutation === "create");

  if (createRows.length === 0) {
    throw new Error(
      `[offline-document-mutations] no create outbox for local document ${document.id}`,
    );
  }

  const [primary, ...rest] = createRows.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const mergedCreate: DocumentCreatePayload = {
    ...(primary.payload as DocumentCreatePayload),
    ...(patch.title != null ? { title: patch.title } : {}),
    ...(patch.metadata != null ? { metadata: patch.metadata } : {}),
    ...(patch.content != null ? { content: patch.content } : {}),
    ...(patch.content_plain != null
      ? { content_plain: patch.content_plain }
      : {}),
  };

  const docStorage = await documentToStorageRecord(document);
  const outboxRecord = await outboxToStorageRecord({
    ...primary,
    payload: mergedCreate,
  });

  const db = await getOfflineDB();
  const tx = db.transaction(["documents", "outbox"], "readwrite");
  const outboxStore = tx.objectStore("outbox");
  await tx.objectStore("documents").put(docStorage);
  await outboxStore.put(outboxRecord);
  for (const row of rest) {
    if (row.id != null) await outboxStore.delete(row.id);
  }
  await tx.done;
}

export async function commitOfflineDocumentUpdate(params: {
  document: OfflineDocumentRecord;
  patch: DocumentPatchPayload;
  expectedUpdatedAt: string;
}): Promise<void> {
  if (isLocalOnlyDocument(params.document)) {
    await commitOfflineLocalDocumentUpdate({
      document: params.document,
      patch: params.patch,
    });
    return;
  }

  await commitOfflineDocumentPatch(params);
}

export async function commitOfflineDocumentDelete(params: {
  documentId: string;
  serverUpdatedAt: string;
  localOnly: boolean;
}): Promise<void> {
  const { documentId, serverUpdatedAt, localOnly } = params;

  if (localOnly) {
    await purgeDocumentOfflineCache(documentId);
    return;
  }

  const outboxRecord = await outboxToStorageRecord({
    document_id: documentId,
    mutation: "delete",
    payload: {},
    expected_updated_at: serverUpdatedAt,
    created_at: new Date().toISOString(),
    retries: 0,
  });

  const existing = await getOutboxForDocument(documentId);

  const db = await getOfflineDB();
  const tx = db.transaction(["documents", "outbox"], "readwrite");
  const outboxStore = tx.objectStore("outbox");
  await tx.objectStore("documents").delete(documentId);
  for (const row of existing) {
    if (row.id != null) await outboxStore.delete(row.id);
  }
  await outboxStore.add(outboxRecord);
  await tx.done;
}

export async function buildOfflineCreateDocument(params: {
  id: string;
  workspaceId: string;
  title?: string;
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
  contentPlain?: string | null;
}): Promise<{
  document: OfflineDocumentRecord;
  create: DocumentCreatePayload;
}> {
  const now = new Date().toISOString();
  const title = params.title ?? "Untitled Document";
  const content = params.content ?? { type: "doc", content: [{ type: "paragraph" }] };
  const contentPlain = params.contentPlain ?? "";
  const metadata = params.metadata ?? {};

  const document = toOfflineDocumentRecord({
    id: params.id,
    workspace_id: params.workspaceId,
    title,
    content,
    content_plain: contentPlain,
    metadata,
    updated_at: now,
    created_at: now,
    server_updated_at: LOCAL_SERVER_UPDATED_AT,
    sync_status: "pending",
  });

  return {
    document,
    create: {
      workspace_id: params.workspaceId,
      title,
      metadata,
      content,
      content_plain: contentPlain,
    },
  };
}

export async function getOfflineDocumentForMutation(
  documentId: string,
): Promise<OfflineDocumentRecord | null> {
  return getOfflineDocument(documentId);
}

export async function markOfflineDocumentPending(
  documentId: string,
): Promise<void> {
  const row = await getOfflineDocument(documentId);
  if (!row) return;
  await putOfflineDocument({ ...row, sync_status: "pending" });
}
