/**
 * Push outbox → PATCH /api/documents.
 *
 * Only title/metadata patches flow through here now — the document body is
 * owned by the Yjs CRDT (see useYjsCollaboration) and persists/merges on its
 * own via document_yjs_state. Title/metadata conflicts are rare, single-field
 * edits, so a 409 here simply refetches and force-overwrites (last write wins)
 * rather than opening a conflict-review UI.
 */

import {
  getOfflineDocument,
  putOfflineDocument,
  setOfflineDocumentStatus,
} from "@/lib/offline/documents-cache";
import {
  clearOutboxForDocument,
  enqueueDocumentPatch,
  getOutboxForDocument,
  listOutbox,
  removeOutboxEntry,
  type DocumentPatchPayload,
} from "@/lib/offline/outbox";
import type { OfflineSyncStatus } from "@/lib/offline/db";
import { getOfflineDB } from "@/lib/offline/db";
import type { DocumentRecord } from "@/hooks/useDocument";

export type SyncStatusEvent = {
  documentId: string;
  status: OfflineSyncStatus;
};

type SyncListener = (event: {
  type: "status" | "drained";
  documentId?: string;
  status?: OfflineSyncStatus;
}) => void;

const listeners = new Set<SyncListener>();
/** Serializes concurrent pushOutbox callers so merged title/metadata patches are not dropped. */
let pushTail: Promise<{ pushed: number; stoppedOnNetwork: boolean }> =
  Promise.resolve({ pushed: 0, stoppedOnNetwork: false });

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

export function notifyDocumentSyncStatus(
  documentId: string,
  status: OfflineSyncStatus,
): void {
  emit({ type: "status", documentId, status });
}

async function patchDocument(
  documentId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`/app/api/documents/${documentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function pushOutbox(): Promise<{
  pushed: number;
  stoppedOnNetwork: boolean;
}> {
  if (typeof window === "undefined") {
    return { pushed: 0, stoppedOnNetwork: false };
  }
  if (!navigator.onLine) {
    return { pushed: 0, stoppedOnNetwork: true };
  }

  const job = () => drainPushOutbox();
  const next = pushTail.then(job, job);
  pushTail = next.then(
    () => ({ pushed: 0, stoppedOnNetwork: false }),
    () => ({ pushed: 0, stoppedOnNetwork: false }),
  );
  return next;
}

async function drainPushOutbox(): Promise<{
  pushed: number;
  stoppedOnNetwork: boolean;
}> {
  let pushed = 0;
  let stoppedOnNetwork = false;

  while (navigator.onLine) {
    const queue = await listOutbox();
    if (queue.length === 0) break;

    let progressed = false;
    for (const entry of queue) {
      if (entry.mutation !== "patch" || entry.id == null) continue;
      if (!navigator.onLine) {
        stoppedOnNetwork = true;
        break;
      }

      const db = await getOfflineDB();
      const freshEntry = await db.get("outbox", entry.id);
      if (!freshEntry || freshEntry.mutation !== "patch" || freshEntry.id == null) {
        continue;
      }

      const patch = freshEntry.payload as DocumentPatchPayload;

      let response: Response;
      try {
        response = await patchDocument(freshEntry.document_id, {
          ...patch,
          expected_updated_at: freshEntry.expected_updated_at,
        });
      } catch {
        stoppedOnNetwork = true;
        break;
      }

      if (response.status === 409) {
        // Rare for title/metadata — last write wins rather than a conflict UI.
        try {
          response = await patchDocument(freshEntry.document_id, {
            ...patch,
            force: true,
          });
        } catch {
          stoppedOnNetwork = true;
          break;
        }
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
        await setOfflineDocumentStatus(freshEntry.document_id, "synced");
      }

      await removeOutboxEntry(freshEntry.id);
      pushed += 1;
      progressed = true;
      emit({
        type: "status",
        documentId: freshEntry.document_id,
        status: "synced",
      });
    }

    if (stoppedOnNetwork || !progressed) break;
  }

  if (pushed > 0) {
    emit({ type: "drained" });
  }

  return { pushed, stoppedOnNetwork };
}

/** Read local sync status for UI. */
export async function getDocumentSyncStatus(
  documentId: string,
): Promise<OfflineSyncStatus | null> {
  const row = await getOfflineDocument(documentId);
  if (!row) return null;
  if (row.sync_status === "pending") {
    const outbox = await getOutboxForDocument(documentId);
    if (outbox.length === 0) return "synced";
  }
  return row.sync_status;
}

/**
 * On cold open: clear stale IDB pending when title/metadata already match
 * server, or drain outbox when local is ahead.
 */
export async function reconcileStalePendingOnOpen(params: {
  documentId: string;
  remote: DocumentRecord;
  cached: NonNullable<Awaited<ReturnType<typeof getOfflineDocument>>>;
}): Promise<{
  document: DocumentRecord;
  syncStatus: OfflineSyncStatus;
  serverUpdatedAt: string;
} | null> {
  const { documentId, remote, cached } = params;
  if (cached.sync_status !== "pending" && cached.sync_status !== "conflict") {
    return null;
  }
  if (typeof navigator === "undefined" || !navigator.onLine) return null;

  if (cached.title === remote.title) {
    await putOfflineDocument({
      id: remote.id,
      workspace_id: remote.workspace_id,
      title: remote.title,
      content: remote.content,
      content_plain: remote.content_plain,
      metadata: remote.metadata,
      server_updated_at: remote.updated_at,
      updated_at: remote.updated_at,
      created_at: remote.created_at,
      sync_status: "synced",
    });
    await clearOutboxForDocument(documentId);
    notifyDocumentSyncStatus(documentId, "synced");
    return {
      document: remote,
      syncStatus: "synced",
      serverUpdatedAt: remote.updated_at,
    };
  }

  await pushOutbox();
  const row = await getOfflineDocument(documentId);
  if (row?.sync_status === "synced") {
    return {
      document: {
        id: row.id,
        workspace_id: row.workspace_id,
        title: row.title,
        content: row.content,
        content_plain: row.content_plain,
        metadata: row.metadata ?? null,
        updated_at: row.updated_at,
        created_at: row.created_at,
      },
      syncStatus: "synced",
      serverUpdatedAt: row.server_updated_at,
    };
  }

  return null;
}

function pullCursorKey(workspaceId: string) {
  return `last_sync_cursor:${workspaceId}`;
}

/** Enqueue a title/metadata patch that must be retried at a rebased server clock. */
export async function enqueueRebasedPatch(params: {
  documentId: string;
  serverUpdatedAt: string;
  patch: DocumentPatchPayload;
}): Promise<{ pushed: number; stoppedOnNetwork: boolean }> {
  await enqueueDocumentPatch({
    documentId: params.documentId,
    patch: params.patch,
    expectedUpdatedAt: params.serverUpdatedAt,
  });
  return pushOutbox();
}

/**
 * Pull remote document updates newer than the workspace cursor.
 * Skips docs that have pending/conflict local state.
 */
export async function pullWorkspaceDocuments(
  workspaceId: string,
): Promise<{ pulled: number }> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { pulled: 0 };
  }

  const db = await getOfflineDB();
  const sinceRaw = await db.get("meta", pullCursorKey(workspaceId));
  const since = typeof sinceRaw === "string" ? sinceRaw : null;

  const params = new URLSearchParams({
    workspace_id: workspaceId,
    filter: "all",
    limit: "50",
  });
  if (since) params.set("since", since);

  let response: Response;
  try {
    response = await fetch(`/app/api/documents?${params.toString()}`);
  } catch {
    return { pulled: 0 };
  }

  if (!response.ok) return { pulled: 0 };
  const data = await response.json().catch(() => ({}));
  const documents = (data.documents as DocumentRecord[]) ?? [];
  let pulled = 0;
  let newest = since;

  for (const remote of documents) {
    const local = await getOfflineDocument(remote.id);
    if (
      local &&
      (local.sync_status === "pending" || local.sync_status === "conflict")
    ) {
      continue;
    }

    await putOfflineDocument(toOfflineRecord(remote));
    pulled += 1;
    if (!newest || remote.updated_at > newest) {
      newest = remote.updated_at;
    }
  }

  if (newest) {
    await db.put("meta", newest, pullCursorKey(workspaceId));
  }

  return { pulled };
}

function toOfflineRecord(remote: DocumentRecord) {
  return {
    id: remote.id,
    workspace_id: remote.workspace_id,
    title: remote.title,
    content: remote.content,
    content_plain: remote.content_plain,
    metadata: remote.metadata,
    server_updated_at: remote.updated_at,
    updated_at: remote.updated_at,
    created_at: remote.created_at,
    sync_status: "synced" as const,
  };
}
