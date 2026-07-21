/**
 * Push outbox → PATCH /api/documents. Pull / conflict UI = later waves.
 */

import {
  getOfflineDocument,
  putOfflineDocument,
  setOfflineDocumentStatus,
} from "@/lib/offline/documents-cache";
import {
  listOutbox,
  removeOutboxEntry,
  type DocumentPatchPayload,
} from "@/lib/offline/outbox";
import type { OfflineSyncStatus } from "@/lib/offline/db";

export type SyncConflictPayload = {
  documentId: string;
  serverDocument: Record<string, unknown>;
};

export type SyncStatusEvent = {
  documentId: string;
  status: OfflineSyncStatus;
};

type SyncListener = (event: {
  type: "status" | "conflict" | "drained";
  documentId?: string;
  status?: OfflineSyncStatus;
  conflict?: SyncConflictPayload;
}) => void;

const listeners = new Set<SyncListener>();
let pushing = false;

export function subscribeSyncEngine(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: Parameters<SyncListener>[0]) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // ignore subscriber errors
    }
  }
}

export async function pushOutbox(): Promise<{
  pushed: number;
  conflicts: SyncConflictPayload[];
  stoppedOnNetwork: boolean;
}> {
  if (typeof window === "undefined") {
    return { pushed: 0, conflicts: [], stoppedOnNetwork: false };
  }
  if (!navigator.onLine) {
    return { pushed: 0, conflicts: [], stoppedOnNetwork: true };
  }
  if (pushing) {
    return { pushed: 0, conflicts: [], stoppedOnNetwork: false };
  }

  pushing = true;
  let pushed = 0;
  const conflicts: SyncConflictPayload[] = [];
  let stoppedOnNetwork = false;

  try {
    const queue = await listOutbox();
    for (const entry of queue) {
      if (entry.mutation !== "patch" || entry.id == null) continue;
      if (!navigator.onLine) {
        stoppedOnNetwork = true;
        break;
      }

      const patch = entry.payload as DocumentPatchPayload;
      let response: Response;
      try {
        response = await fetch(`/app/api/documents/${entry.document_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...patch,
            expected_updated_at: entry.expected_updated_at,
          }),
        });
      } catch {
        stoppedOnNetwork = true;
        break;
      }

      if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        await setOfflineDocumentStatus(entry.document_id, "conflict");
        const conflict: SyncConflictPayload = {
          documentId: entry.document_id,
          serverDocument:
            (data.document as Record<string, unknown>) ??
            (data as Record<string, unknown>),
        };
        conflicts.push(conflict);
        emit({
          type: "conflict",
          documentId: entry.document_id,
          status: "conflict",
          conflict,
        });
        emit({
          type: "status",
          documentId: entry.document_id,
          status: "conflict",
        });
        // Leave outbox entry until user resolves (Wave B).
        continue;
      }

      if (!response.ok) {
        // Auth / validation — stop to avoid tight loops.
        break;
      }

      const data = await response.json().catch(() => ({}));
      const serverDoc = data.document as
        | {
            id: string;
            workspace_id: string;
            title: string;
            content: Record<string, unknown> | null;
            content_plain: string | null;
            metadata: Record<string, unknown> | null;
            updated_at: string;
            created_at: string;
          }
        | undefined;

      if (serverDoc) {
        await putOfflineDocument({
          id: serverDoc.id,
          workspace_id: serverDoc.workspace_id,
          title: serverDoc.title,
          content: serverDoc.content,
          content_plain: serverDoc.content_plain,
          metadata: serverDoc.metadata,
          server_updated_at: serverDoc.updated_at,
          updated_at: serverDoc.updated_at,
          created_at: serverDoc.created_at,
          sync_status: "synced",
        });
      } else {
        await setOfflineDocumentStatus(entry.document_id, "synced");
      }

      await removeOutboxEntry(entry.id);
      pushed += 1;
      emit({
        type: "status",
        documentId: entry.document_id,
        status: "synced",
      });
    }

    if (pushed > 0) {
      emit({ type: "drained" });
    }
  } finally {
    pushing = false;
  }

  return { pushed, conflicts, stoppedOnNetwork };
}

/** Read local sync status for UI. */
export async function getDocumentSyncStatus(
  documentId: string,
): Promise<OfflineSyncStatus | null> {
  const row = await getOfflineDocument(documentId);
  return row?.sync_status ?? null;
}
