/**
 * IndexedDB cache for documents (Phase 09). Syncs via outbox — never Ask.
 * M1b.1: body fields encrypted at rest via docs-vault; title/sync_status stay plaintext.
 */

import {
  getOfflineDB,
  type OfflineDocumentRecord,
  type OfflineDocumentStorageRecord,
  type OfflineSyncStatus,
} from "@/lib/offline/db";
import {
  decryptDocsJson,
  encryptDocsJson,
} from "@/lib/offline/docs-vault";
import { LOCAL_SERVER_UPDATED_AT } from "@/lib/offline/local-document";

export type OfflineDocumentReadFailureReason =
  | "not_cached"
  | "vault_locked"
  | "decrypt_failed"
  | "idb_unavailable";

export class OfflineDocumentReadError extends Error {
  readonly reason: OfflineDocumentReadFailureReason;

  constructor(
    reason: OfflineDocumentReadFailureReason,
    message?: string,
    options?: { cause?: unknown },
  ) {
    super(message ?? reason, options);
    this.name = "OfflineDocumentReadError";
    this.reason = reason;
  }
}

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

export async function getOfflineDocumentStrict(
  documentId: string,
): Promise<OfflineDocumentRecord> {
  let db;
  try {
    db = await getOfflineDB();
  } catch (error) {
    throw new OfflineDocumentReadError(
      "idb_unavailable",
      "IndexedDB is unavailable",
      { cause: error },
    );
  }

  let row: OfflineDocumentStorageRecord | undefined;
  try {
    row = await db.get("documents", documentId);
  } catch (error) {
    throw new OfflineDocumentReadError(
      "idb_unavailable",
      "Failed to read document from IndexedDB",
      { cause: error },
    );
  }

  if (!row) {
    throw new OfflineDocumentReadError(
      "not_cached",
      "Document is not cached for offline use",
    );
  }

  try {
    return await fromStorageRecord(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Decrypt failed";
    const reason: OfflineDocumentReadFailureReason =
      message.toLowerCase().includes("locked") ? "vault_locked" : "decrypt_failed";
    throw new OfflineDocumentReadError(reason, message, { cause: error });
  }
}

export async function getOfflineDocument(
  documentId: string,
): Promise<OfflineDocumentRecord | null> {
  try {
    return await getOfflineDocumentStrict(documentId);
  } catch {
    return null;
  }
}

export async function listOfflineDocumentRowsForWorkspace(
  workspaceId: string,
): Promise<OfflineDocumentStorageRecord[]> {
  const db = await getOfflineDB();
  return db.getAllFromIndex("documents", "by-workspace", workspaceId);
}

function storageRowNeedsMerge(row: OfflineDocumentStorageRecord): boolean {
  return (
    row.sync_status === "pending" ||
    row.sync_status === "conflict" ||
    row.server_updated_at === LOCAL_SERVER_UPDATED_AT
  );
}

/** List rows that may override server list metadata (pending / local-only). */
export async function listMergeableOfflineDocumentsForWorkspace(
  workspaceId: string,
): Promise<OfflineDocumentRecord[]> {
  const rows = await listOfflineDocumentRowsForWorkspace(workspaceId);
  const records: OfflineDocumentRecord[] = [];
  for (const row of rows) {
    if (!storageRowNeedsMerge(row)) continue;
    try {
      records.push(await fromStorageRecord(row));
    } catch {
      // Skip rows that cannot be decrypted (e.g. vault not ready yet).
    }
  }
  return records;
}

async function fromStorageSummary(
  row: OfflineDocumentStorageRecord,
): Promise<OfflineDocumentRecord> {
  const metadata =
    row.metadata_enc != null
      ? await decryptDocsJson<Record<string, unknown>>(row.metadata_enc)
      : null;

  return {
    id: row.id,
    workspace_id: row.workspace_id,
    title: row.title,
    content: null,
    content_plain: null,
    metadata,
    server_updated_at: row.server_updated_at,
    updated_at: row.updated_at,
    created_at: row.created_at,
    sync_status: row.sync_status,
  };
}

/** Fast workspace list for offline UI — decrypts metadata only, not document bodies. */
export async function listOfflineDocumentSummariesForWorkspace(
  workspaceId: string,
): Promise<OfflineDocumentRecord[]> {
  const rows = await listOfflineDocumentRowsForWorkspace(workspaceId);
  const records: OfflineDocumentRecord[] = [];
  for (const row of rows) {
    try {
      records.push(await fromStorageSummary(row));
    } catch {
      // Skip rows that cannot be decrypted (e.g. vault not ready yet).
    }
  }
  return records.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function listOfflineDocumentsForWorkspace(
  workspaceId: string,
): Promise<OfflineDocumentRecord[]> {
  const rows = await listOfflineDocumentRowsForWorkspace(workspaceId);
  const records: OfflineDocumentRecord[] = [];
  for (const row of rows) {
    try {
      records.push(await fromStorageRecord(row));
    } catch {
      // Skip rows that cannot be decrypted (e.g. vault not ready yet).
    }
  }
  return records.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
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

export async function deleteOfflineDocument(documentId: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("documents", documentId);
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
