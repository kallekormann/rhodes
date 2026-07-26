/**
 * IndexedDB cache for documents (Phase 09). Syncs via outbox — never Ask.
 */

import {
  getOfflineDB,
  type OfflineDocumentRecord,
  type OfflineSyncStatus,
} from "@/lib/offline/db";

export async function getOfflineDocument(
  documentId: string,
): Promise<OfflineDocumentRecord | null> {
  const db = await getOfflineDB();
  return (await db.get("documents", documentId)) ?? null;
}

export async function putOfflineDocument(
  record: OfflineDocumentRecord,
): Promise<void> {
  const db = await getOfflineDB();
  await db.put("documents", record);
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
