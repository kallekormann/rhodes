/**
 * IndexedDB cache for documents (Phase 09). Syncs via outbox — never Ask.
 * M1b.1: body fields encrypted at rest via docs-vault; title/sync_status stay plaintext.
 */

import {
  decryptDocsJson,
  encryptDocsJson,
} from "@/lib/offline/docs-vault";
import {
  getOfflineDB,
  type OfflineDocumentRecord,
  type OfflineDocumentStorageRecord,
  type OfflineSyncStatus,
} from "@/lib/offline/db";

async function toStorageRecord(
  record: OfflineDocumentRecord,
): Promise<OfflineDocumentStorageRecord> {
  const [content_enc, content_plain_enc, metadata_enc] = await Promise.all([
    record.content != null ? encryptDocsJson(record.content) : null,
    record.content_plain != null ? encryptDocsJson(record.content_plain) : null,
    record.metadata != null ? encryptDocsJson(record.metadata) : null,
  ]);

  return {
    id: record.id,
    workspace_id: record.workspace_id,
    title: record.title,
    content_enc,
    content_plain_enc,
    metadata_enc,
    server_updated_at: record.server_updated_at,
    updated_at: record.updated_at,
    created_at: record.created_at,
    sync_status: record.sync_status,
  };
}

/** @internal used by offline-document-patch */
export async function documentToStorageRecord(
  record: OfflineDocumentRecord,
): Promise<OfflineDocumentStorageRecord> {
  return toStorageRecord(record);
}

async function fromStorageRecord(
  row: OfflineDocumentStorageRecord,
): Promise<OfflineDocumentRecord> {
  const [content, content_plain, metadata] = await Promise.all([
    row.content_enc != null
      ? decryptDocsJson<Record<string, unknown>>(row.content_enc)
      : null,
    row.content_plain_enc != null
      ? decryptDocsJson<string>(row.content_plain_enc)
      : null,
    row.metadata_enc != null
      ? decryptDocsJson<Record<string, unknown>>(row.metadata_enc)
      : null,
  ]);

  return {
    id: row.id,
    workspace_id: row.workspace_id,
    title: row.title,
    content,
    content_plain,
    metadata,
    server_updated_at: row.server_updated_at,
    updated_at: row.updated_at,
    created_at: row.created_at,
    sync_status: row.sync_status,
  };
}

export async function getOfflineDocument(
  documentId: string,
): Promise<OfflineDocumentRecord | null> {
  const db = await getOfflineDB();
  const row = await db.get("documents", documentId);
  if (!row) return null;
  return fromStorageRecord(row);
}

export async function putOfflineDocument(
  record: OfflineDocumentRecord,
): Promise<void> {
  const storage = await toStorageRecord(record);
  const db = await getOfflineDB();
  await db.put("documents", storage);
  const verified = await db.get("documents", storage.id);
  if (!verified) {
    throw new Error(
      `[documents-cache] put verify failed for document ${storage.id}`,
    );
  }
}

export async function setOfflineDocumentStatus(
  documentId: string,
  sync_status: OfflineSyncStatus,
): Promise<void> {
  const db = await getOfflineDB();
  const existing = await db.get("documents", documentId);
  if (!existing) return;
  await db.put("documents", { ...existing, sync_status });
}

export function toOfflineDocumentRecord(input: {
  id: string;
  workspace_id: string;
  title: string;
  content: Record<string, unknown> | null;
  content_plain: string | null;
  metadata?: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
  server_updated_at?: string;
  sync_status?: OfflineSyncStatus;
}): OfflineDocumentRecord {
  return {
    id: input.id,
    workspace_id: input.workspace_id,
    title: input.title,
    content: input.content,
    content_plain: input.content_plain,
    metadata: input.metadata ?? null,
    server_updated_at: input.server_updated_at ?? input.updated_at,
    updated_at: input.updated_at,
    created_at: input.created_at,
    sync_status: input.sync_status ?? "synced",
  };
}
