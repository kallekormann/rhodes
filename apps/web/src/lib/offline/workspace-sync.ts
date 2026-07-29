/**
 * Background workspace sync — runs on reconnect without opening the editor.
 */

import {
  listOfflineDocumentsForWorkspace,
} from "@/lib/offline/documents-cache";
import { bodyRichness, plainTextFromBody } from "@/lib/offline/document-body";
import { flushEditorSavesBeforeSync } from "@/lib/offline/editor-save-flush";
import {
  documentHasUnsentWork,
  documentRecordHasUnsentWork,
  hasLocalEditsSinceServerSync,
} from "@/lib/offline/document-unsent-work";
import { isLocalOnlyDocument } from "@/lib/offline/local-document";
import {
  commitOfflineDocumentUpdate,
  markOfflineDocumentPending,
} from "@/lib/offline/offline-document-mutations";
import {
  documentHasPendingOutbox,
  repairPendingStatusFromOutbox,
} from "@/lib/offline/offline-sync-status";
import {
  enqueueDocumentPatch,
  getOutboxForDocument,
  listOutbox,
  type DocumentPatchPayload,
} from "@/lib/offline/outbox";
import { awaitPendingDocumentSaves } from "@/lib/offline/pending-document-saves";
import {
  notifyDocumentSyncStatus,
  pullWorkspaceDocuments,
  pushOutbox,
} from "@/lib/offline/sync-engine";

export type WorkspaceSyncState = {
  active: boolean;
  documentTitle: string | null;
  pendingCount: number;
  pendingTitles: string[];
};

export type SyncResult = {
  pushed: number;
  stoppedOnNetwork: boolean;
  skipped: boolean;
};

type WorkspaceSyncListener = (state: WorkspaceSyncState) => void;

const listeners = new Set<WorkspaceSyncListener>();
let workspaceSyncState: WorkspaceSyncState = {
  active: false,
  documentTitle: null,
  pendingCount: 0,
  pendingTitles: [],
};

const syncInFlight = new Map<string, Promise<SyncResult>>();

function emitWorkspaceSync(state: WorkspaceSyncState): void {
  workspaceSyncState = state;
  for (const listener of listeners) {
    try {
      listener(state);
    } catch {
      /* ignore */
    }
  }
}

export function getWorkspaceSyncState(): WorkspaceSyncState {
  return workspaceSyncState;
}

export function subscribeWorkspaceSync(
  listener: WorkspaceSyncListener,
): () => void {
  listeners.add(listener);
  listener(workspaceSyncState);
  return () => listeners.delete(listener);
}

export async function getWorkspacePendingSyncInfo(
  workspaceId: string,
): Promise<{ pendingCount: number; pendingTitles: string[] }> {
  const docs = await listOfflineDocumentsForWorkspace(workspaceId);
  const outbox = await listOutbox();
  const outboxDocIds = new Set(
    outbox
      .filter((row) => {
        if (row.mutation === "create") {
          const payload = row.payload as { workspace_id?: string };
          return payload.workspace_id === workspaceId;
        }
        return docs.some((doc) => doc.id === row.document_id);
      })
      .map((row) => row.document_id),
  );

  const pendingTitles: string[] = [];
  const seen = new Set<string>();

  for (const doc of docs) {
    const pending =
      documentRecordHasUnsentWork(doc) || outboxDocIds.has(doc.id);
    if (pending && !seen.has(doc.id)) {
      seen.add(doc.id);
      pendingTitles.push(doc.title);
    }
  }

  for (const docId of outboxDocIds) {
    if (seen.has(docId)) continue;
    const doc = docs.find((row) => row.id === docId);
    pendingTitles.push(doc?.title ?? "Untitled");
    seen.add(docId);
  }

  return { pendingCount: pendingTitles.length, pendingTitles };
}

export async function workspaceHasPendingSync(
  workspaceId: string,
): Promise<boolean> {
  const { pendingCount } = await getWorkspacePendingSyncInfo(workspaceId);
  return pendingCount > 0;
}

/** @alias workspaceHasPendingSync */
export const workspaceHasUnsentWork = workspaceHasPendingSync;

/** Ensure outbox rows reflect the latest encrypted document bodies in IDB. */
export async function reconcileWorkspaceOutboxFromCache(
  workspaceId: string,
): Promise<void> {
  const docs = await listOfflineDocumentsForWorkspace(workspaceId);

  for (const doc of docs) {
    const rich = bodyRichness(doc.content, doc.content_plain);
    const outbox = await getOutboxForDocument(doc.id);

    if (outbox.length > 0 && doc.sync_status === "synced") {
      await repairPendingStatusFromOutbox(doc.id);
      await markOfflineDocumentPending(doc.id);
      notifyDocumentSyncStatus(doc.id, "pending");
    }

    const needsReconcile =
      doc.sync_status === "pending" ||
      doc.sync_status === "conflict" ||
      isLocalOnlyDocument(doc) ||
      outbox.length > 0 ||
      hasLocalEditsSinceServerSync(doc);

    if (!needsReconcile) continue;
    if (rich === 0 && outbox.length === 0) continue;

    const createRows = outbox.filter((row) => row.mutation === "create");

    if (createRows.length > 0) {
      await commitOfflineDocumentUpdate({
        document: doc,
        patch: {
          title: doc.title,
          content: doc.content ?? undefined,
          content_plain: plainTextFromBody(doc.content, doc.content_plain),
          metadata: doc.metadata ?? undefined,
        },
        expectedUpdatedAt: doc.server_updated_at,
      });
      notifyDocumentSyncStatus(doc.id, "pending");
      continue;
    }

    const patchRich = outbox
      .filter((row) => row.mutation === "patch")
      .reduce((max, row) => {
        const patch = row.payload as DocumentPatchPayload;
        return Math.max(
          max,
          bodyRichness(patch.content ?? null, patch.content_plain ?? null),
        );
      }, 0);

    if (patchRich >= rich || !doc.content) continue;

    await enqueueDocumentPatch({
      documentId: doc.id,
      patch: {
        content: doc.content,
        content_plain: plainTextFromBody(doc.content, doc.content_plain),
      },
      expectedUpdatedAt: doc.server_updated_at,
    });
    await markOfflineDocumentPending(doc.id);
    notifyDocumentSyncStatus(doc.id, "pending");
  }
}

/** Push outbox only when the workspace has unsent work. No UI when skipped. */
export async function syncIfNeeded(workspaceId: string): Promise<SyncResult> {
  const inFlight = syncInFlight.get(workspaceId);
  if (inFlight) return inFlight;

  const job = (async (): Promise<SyncResult> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { pushed: 0, stoppedOnNetwork: true, skipped: true };
    }

    const pendingInfo = await getWorkspacePendingSyncInfo(workspaceId);
    if (pendingInfo.pendingCount === 0) {
      return { pushed: 0, stoppedOnNetwork: false, skipped: true };
    }

    emitWorkspaceSync({
      active: true,
      documentTitle: pendingInfo.pendingTitles[0] ?? "Syncing documents…",
      pendingCount: pendingInfo.pendingCount,
      pendingTitles: pendingInfo.pendingTitles,
    });

    try {
      flushEditorSavesBeforeSync();
      await awaitPendingDocumentSaves();
      await reconcileWorkspaceOutboxFromCache(workspaceId);

      const refreshed = await getWorkspacePendingSyncInfo(workspaceId);
      if (refreshed.pendingCount > 0) {
        emitWorkspaceSync({
          active: true,
          documentTitle:
            refreshed.pendingTitles[0] ?? "Syncing document…",
          pendingCount: refreshed.pendingCount,
          pendingTitles: refreshed.pendingTitles,
        });
      }

      const result = await pushOutbox();
      await pullWorkspaceDocuments(workspaceId);
      return { ...result, skipped: false };
    } finally {
      emitWorkspaceSync({
        active: false,
        documentTitle: null,
        pendingCount: 0,
        pendingTitles: [],
      });
      syncInFlight.delete(workspaceId);
    }
  })();

  syncInFlight.set(workspaceId, job);
  return job;
}

/** @deprecated Prefer syncIfNeeded */
export async function syncWorkspaceDocuments(
  workspaceId: string,
): Promise<{ pushed: number; stoppedOnNetwork: boolean }> {
  const result = await syncIfNeeded(workspaceId);
  return { pushed: result.pushed, stoppedOnNetwork: result.stoppedOnNetwork };
}

/** Push a single document before opening the editor (only when it has unsent work). */
export async function awaitDocumentPushIfNeeded(
  documentId: string,
  workspaceId: string,
): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (!(await documentHasUnsentWork(documentId, workspaceId))) return;

  flushEditorSavesBeforeSync();
  await awaitPendingDocumentSaves();
  await reconcileWorkspaceOutboxFromCache(workspaceId);

  if (!(await documentHasUnsentWork(documentId, workspaceId))) return;

  const doc = (await listOfflineDocumentsForWorkspace(workspaceId)).find(
    (row) => row.id === documentId,
  );

  emitWorkspaceSync({
    active: true,
    documentTitle: doc?.title ?? "Syncing document…",
    pendingCount: 1,
    pendingTitles: [doc?.title ?? "Syncing document…"],
  });

  try {
    let attempts = 0;
    while (
      attempts < 12 &&
      (await documentHasUnsentWork(documentId, workspaceId))
    ) {
      const result = await pushOutbox();
      attempts += 1;
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      if (result.stoppedOnNetwork) break;
    }
  } finally {
    emitWorkspaceSync({
      active: false,
      documentTitle: null,
      pendingCount: 0,
      pendingTitles: [],
    });
  }
}

/** @deprecated Use awaitDocumentPushIfNeeded */
export const ensureDocumentSynced = awaitDocumentPushIfNeeded;

export { documentHasUnsentWork, documentRecordHasUnsentWork };
