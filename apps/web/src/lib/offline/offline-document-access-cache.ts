/**
 * Eager cache / purge for per-user offline document access (M1b.2 slice 4).
 */

import type { DocumentRecord } from "@/hooks/useDocument";
import { deleteYjsState } from "@/lib/offline/db";
import {
  deleteOfflineDocument,
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { ensureDocsVaultUnlocked } from "@/lib/offline/offline-vault-session";
import { clearOutboxForDocument } from "@/lib/offline/outbox";
import { clearOfflineSnapshots } from "@/lib/offline/yjs-offline-snapshot";
import { clearRhodesYjsPersistence } from "@/lib/offline/yjs-rhodes-persistence";

export async function fetchCanOfflineEditDocument(
  documentId: string,
  activeWorkspaceId?: string | null,
): Promise<boolean> {
  const params = new URLSearchParams();
  if (activeWorkspaceId) params.set("active_workspace_id", activeWorkspaceId);

  const response = await fetch(
    `/app/api/documents/${documentId}/shares?${params.toString()}`,
  );
  if (!response.ok) return false;

  const data = (await response.json().catch(() => ({}))) as {
    can_offline_edit?: boolean;
  };
  return data.can_offline_edit === true;
}

export async function cacheDocumentForOfflineAccess(
  document: DocumentRecord,
  userId: string,
): Promise<void> {
  await ensureDocsVaultUnlocked(userId);
  await putOfflineDocument(
    toOfflineDocumentRecord({
      ...document,
      server_updated_at: document.updated_at,
      sync_status: "synced",
    }),
  );
}

export async function purgeDocumentOfflineCache(documentId: string): Promise<void> {
  await Promise.allSettled([
    deleteOfflineDocument(documentId),
    clearOutboxForDocument(documentId),
    deleteYjsState(documentId),
    clearOfflineSnapshots(documentId),
    clearRhodesYjsPersistence(documentId),
  ]);
}

export async function syncOfflineDocumentAccess(params: {
  documentId: string;
  userId: string;
  activeWorkspaceId?: string | null;
  document?: DocumentRecord | null;
}): Promise<void> {
  const canOffline = await fetchCanOfflineEditDocument(
    params.documentId,
    params.activeWorkspaceId,
  );

  if (!canOffline) {
    await purgeDocumentOfflineCache(params.documentId);
    return;
  }

  let document = params.document;
  if (!document) {
    const response = await fetch(`/app/api/documents/${params.documentId}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.document) return;
    document = data.document as DocumentRecord;
  }

  await cacheDocumentForOfflineAccess(document, params.userId);
}
