/**
 * M1c — LRU eviction for encrypted document cache in IndexedDB.
 */

import {
  deleteYjsState,
  getOfflineDB,
  type OfflineDocumentStorageRecord,
} from "@/lib/offline/db";
import { LOCAL_SERVER_UPDATED_AT } from "@/lib/offline/local-document";
import { documentHasPendingOutbox } from "@/lib/offline/offline-sync-status";

export const DEFAULT_MAX_CACHED_DOCS_PER_WORKSPACE = 100;

function rowLastAccessed(row: OfflineDocumentStorageRecord): number {
  const raw = row.last_accessed_at ?? row.updated_at;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function rowIsEvictable(row: OfflineDocumentStorageRecord): boolean {
  if (row.sync_status !== "synced") return false;
  if (row.server_updated_at === LOCAL_SERVER_UPDATED_AT) return false;
  return true;
}

export async function evictWorkspaceDocumentsIfNeeded(
  workspaceId: string,
  cap: number = DEFAULT_MAX_CACHED_DOCS_PER_WORKSPACE,
): Promise<{ evicted: number }> {
  const db = await getOfflineDB();
  const rows = await db.getAllFromIndex(
    "documents",
    "by-workspace",
    workspaceId,
  );
  const evictable: OfflineDocumentStorageRecord[] = [];
  for (const row of rows) {
    if (!rowIsEvictable(row)) continue;
    if (await documentHasPendingOutbox(row.id)) continue;
    evictable.push(row);
  }

  if (evictable.length <= cap) {
    return { evicted: 0 };
  }

  evictable.sort((a, b) => rowLastAccessed(a) - rowLastAccessed(b));
  const toRemove = evictable.slice(0, evictable.length - cap);
  let evicted = 0;

  for (const row of toRemove) {
    await db.delete("documents", row.id);
    await deleteYjsState(row.id);
    evicted += 1;
  }

  return { evicted };
}
