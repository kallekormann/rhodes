/**
 * M1c.6 — Per-scope offline document cache stats for Settings.
 */

import { getOfflineDB } from "@/lib/offline/db";
import { DEFAULT_MAX_CACHED_DOCS_PER_WORKSPACE } from "@/lib/offline/cache-eviction";

export type OfflineWorkspaceCacheStats = {
  workspaceId: string;
  documentCount: number;
  cap: number;
};

export type OfflineCacheStats = {
  totalDocuments: number;
  workspaces: OfflineWorkspaceCacheStats[];
};

export async function getOfflineCacheStats(): Promise<OfflineCacheStats> {
  const db = await getOfflineDB();
  const rows = await db.getAll("documents");
  const byWorkspace = new Map<string, number>();

  for (const row of rows) {
    byWorkspace.set(
      row.workspace_id,
      (byWorkspace.get(row.workspace_id) ?? 0) + 1,
    );
  }

  const workspaces: OfflineWorkspaceCacheStats[] = Array.from(
    byWorkspace.entries(),
  )
    .map(([workspaceId, documentCount]) => ({
      workspaceId,
      documentCount,
      cap: DEFAULT_MAX_CACHED_DOCS_PER_WORKSPACE,
    }))
    .sort((a, b) => b.documentCount - a.documentCount);

  return {
    totalDocuments: rows.length,
    workspaces,
  };
}
