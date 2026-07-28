"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { isDocumentId } from "@/lib/documents/ids";
import { documentHasUnsentWork } from "@/lib/offline/document-unsent-work";
import { bodyRichness } from "@/lib/offline/document-body";
import { extractPlainText } from "@/lib/documents/plain-text";
import type { DocumentShareContext } from "@/lib/documents/share-context";
import {
  getOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import {
  loadDocumentErrorMessage,
  loadDocumentFromIdb,
} from "@/lib/offline/load-document";
import { syncOfflineDocumentAccess } from "@/lib/offline/offline-document-access-cache";
import { commitOfflineDocumentUpdate } from "@/lib/offline/offline-document-mutations";
import { ensureDocsVaultUnlocked } from "@/lib/offline/offline-vault-session";
import { getOutboxForDocument } from "@/lib/offline/outbox";
import {
  documentHasPendingOutbox,
  repairPendingStatusFromOutbox,
} from "@/lib/offline/offline-sync-status";
import {
  pushOutbox,
  reconcileStalePendingOnOpen,
  subscribeSyncEngine,
  notifyDocumentSyncStatus,
} from "@/lib/offline/sync-engine";
import { trackPendingDocumentSave } from "@/lib/offline/pending-document-saves";
import type { OfflineSyncStatus } from "@/lib/offline/db";
import {
  inspectOfflineDocument,
  logOfflineDocInspect,
} from "@/lib/dev/offline-doc-debug";

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function logCacheError(context: string, error: unknown): void {
  console.error(`[useDocument] ${context}`, error);
}

export type DocumentRecord = {
  id: string;
  workspace_id: string;
  created_by?: string | null;
  title: string;
  content: Record<string, unknown> | null;
  content_plain: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
  share_context?: DocumentShareContext | null;
};

type DocumentPatch = {
  title?: string;
  content?: Record<string, unknown>;
  content_plain?: string;
  metadata?: Record<string, unknown>;
};

function recordFromOffline(row: {
  id: string;
  workspace_id: string;
  title: string;
  content: Record<string, unknown> | null;
  content_plain: string | null;
  metadata?: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
}): DocumentRecord {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    title: row.title,
    content: row.content,
    content_plain: row.content_plain,
    metadata: row.metadata ?? null,
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

function contentRichness(
  content: Record<string, unknown> | null | undefined,
  content_plain: string | null | undefined,
): number {
  return bodyRichness(content, content_plain);
}

function withoutRegressiveContentPatch(
  prev: DocumentRecord,
  patch: DocumentPatch,
): DocumentPatch {
  if (patch.content === undefined && patch.content_plain === undefined) {
    return patch;
  }

  const prevRich = contentRichness(prev.content, prev.content_plain);
  const candidateContent = patch.content ?? prev.content;
  const candidatePlain = patch.content_plain ?? prev.content_plain;
  const nextRich = contentRichness(candidateContent, candidatePlain);

  if (nextRich >= prevRich) return patch;

  const { content: _content, content_plain: _plain, ...rest } = patch;
  return rest;
}

export function useDocument(
  documentId: string | null,
  online: boolean = true,
) {
  const { session, workspaceId } = useApp();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(documentId));
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus | null>(null);
  const serverUpdatedAtRef = useRef<string | null>(null);
  const documentRef = useRef<DocumentRecord | null>(null);
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const loadGeneration = ++loadGenerationRef.current;
    const isStale = () => loadGeneration !== loadGenerationRef.current;

    if (!documentId || !isDocumentId(documentId)) {
      if (isStale()) return;
      setDocument(null);
      setLoading(false);
      setError(documentId ? "Invalid document id" : null);
      serverUpdatedAtRef.current = null;
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);

    const idbResult = await loadDocumentFromIdb(documentId, session.userId);
    if (isStale()) return;
    const cached = idbResult.ok ? idbResult.document : null;

    const cachedRich =
      cached != null
        ? bodyRichness(cached.content, cached.content_plain)
        : 0;

    if (cached && cachedRich > 0 && !isBrowserOffline() && online) {
      if (isStale()) return;
      setDocument(recordFromOffline(cached));
      serverUpdatedAtRef.current =
        cached.server_updated_at || cached.updated_at;
      setSyncStatus(cached.sync_status);
      if (!options?.silent) setLoading(false);
    }

    if (
      cached &&
      (cached.sync_status === "pending" || cached.sync_status === "conflict")
    ) {
      if (isStale()) return;
      setDocument(recordFromOffline(cached));
      serverUpdatedAtRef.current =
        cached.server_updated_at || cached.updated_at;
      setSyncStatus(cached.sync_status);
      if (!options?.silent) setLoading(false);
    }

    if (isBrowserOffline() || !online) {
      if (cached) {
        if (isStale()) return;
        setDocument(recordFromOffline(cached));
        serverUpdatedAtRef.current =
          cached.server_updated_at || cached.updated_at;
        setSyncStatus(cached.sync_status);
        if (process.env.NODE_ENV !== "production") {
          const inspect = await inspectOfflineDocument(
            documentId,
            session.userId,
          );
          if (isStale()) return;
          logOfflineDocInspect("loaded", inspect);
        }
      } else if (!options?.silent) {
        if (isStale()) return;
        setError(
          loadDocumentErrorMessage(
            idbResult.ok ? "not_cached" : idbResult.reason,
            idbResult.ok ? undefined : idbResult.detail,
          ),
        );
        setDocument(null);
        if (process.env.NODE_ENV !== "production") {
          const inspect = await inspectOfflineDocument(
            documentId,
            session.userId,
          );
          if (isStale()) return;
          logOfflineDocInspect("missing", inspect);
        }
      }
      if (isStale()) return;
      setLoading(false);
      return;
    }

    try {
      const fetchOptions: RequestInit = {};
      if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
        fetchOptions.signal = AbortSignal.timeout(8_000);
      }
      const response = await fetch(
        `/app/api/documents/${documentId}`,
        fetchOptions,
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (cached) {
          setDocument(recordFromOffline(cached));
          serverUpdatedAtRef.current =
            cached.server_updated_at || cached.updated_at;
          setSyncStatus(cached.sync_status);
          setLoading(false);
          return;
        }
        const message =
          typeof data.error === "string"
            ? data.error
            : "Failed to load document";
        if (!options?.silent) {
          setError(message);
          setDocument(null);
        }
        setLoading(false);
        return;
      }

      const remote = data.document as DocumentRecord;

      let freshCached = cached;
      try {
        freshCached = await getOfflineDocument(documentId);
      } catch {
        /* IndexedDB unavailable */
      }

      if (
        freshCached &&
        (freshCached.sync_status === "pending" ||
          freshCached.sync_status === "conflict")
      ) {
        const localPlain = (freshCached.content_plain ?? "").trim();
        const remotePlain = (remote.content_plain ?? "").trim();
        // Never prefer an empty pending wipe over a non-empty server document.
        if (localPlain.length === 0 && remotePlain.length > 0) {
          setDocument(remote);
          serverUpdatedAtRef.current = remote.updated_at;
          setSyncStatus("synced");
          try {
            if (session.userId) {
              await syncOfflineDocumentAccess({
                documentId,
                userId: session.userId,
                activeWorkspaceId: workspaceId,
                document: remote,
              });
            }
          } catch (error) {
            logCacheError("cache wipe-pending failed", error);
          }
          setLoading(false);
          return;
        }

        const reconciled = await reconcileStalePendingOnOpen({
          documentId,
          remote,
          cached: freshCached,
        });
        if (reconciled) {
          setDocument(reconciled.document);
          serverUpdatedAtRef.current = reconciled.serverUpdatedAt;
          setSyncStatus(reconciled.syncStatus);
          setLoading(false);
          return;
        }

        setDocument(recordFromOffline(freshCached));
        serverUpdatedAtRef.current =
          freshCached.server_updated_at || freshCached.updated_at;
        setSyncStatus(freshCached.sync_status);
        setLoading(false);
        return;
      }

      if (await documentHasPendingOutbox(documentId)) {
        const repaired = await repairPendingStatusFromOutbox(documentId);
        if (repaired.includes(documentId)) {
          notifyDocumentSyncStatus(documentId, "pending");
        }
        const local =
          (await getOfflineDocument(documentId)) ?? freshCached ?? cached;
        if (local) {
          setDocument(recordFromOffline(local));
          serverUpdatedAtRef.current =
            local.server_updated_at || local.updated_at;
          setSyncStatus("pending");
          setLoading(false);
          void pushOutbox();
          return;
        }
      }

      const richestCached = freshCached ?? cached;
      const hasUnsent = await documentHasUnsentWork(
        documentId,
        workspaceId ?? richestCached?.workspace_id,
      );

      if (richestCached && !hasUnsent) {
        const serverAt = richestCached.server_updated_at || "";
        const remoteAt = remote.updated_at || "";
        const localRich = contentRichness(
          richestCached.content,
          richestCached.content_plain,
        );
        const remoteRich = contentRichness(remote.content, remote.content_plain);
        if (remoteAt > serverAt && remoteRich >= localRich) {
          setDocument(remote);
          serverUpdatedAtRef.current = remote.updated_at;
          setSyncStatus("synced");
          try {
            if (session.userId) {
              await syncOfflineDocumentAccess({
                documentId,
                userId: session.userId,
                activeWorkspaceId: workspaceId,
                document: remote,
              });
            }
          } catch (error) {
            logCacheError("cache on open failed", error);
          }
          setLoading(false);
          return;
        }
      }

      if (richestCached) {
        const localRich = contentRichness(
          richestCached.content,
          richestCached.content_plain,
        );
        const remoteRich = contentRichness(remote.content, remote.content_plain);
        if (localRich > remoteRich) {
          setDocument(recordFromOffline(richestCached));
          serverUpdatedAtRef.current =
            richestCached.server_updated_at || richestCached.updated_at;
          setSyncStatus(
            richestCached.sync_status === "synced" ? "pending" : richestCached.sync_status,
          );
          setLoading(false);
          void pushOutbox();
          return;
        }
      }

      setDocument(remote);
      serverUpdatedAtRef.current = remote.updated_at;
      setSyncStatus("synced");

      try {
        if (session.userId) {
          await syncOfflineDocumentAccess({
            documentId,
            userId: session.userId,
            activeWorkspaceId: workspaceId,
            document: remote,
          });
        }
      } catch (error) {
        logCacheError("cache on open failed", error);
      }

      setLoading(false);
    } catch {
      if (cached) {
        setDocument(recordFromOffline(cached));
        serverUpdatedAtRef.current =
          cached.server_updated_at || cached.updated_at;
        setSyncStatus(cached.sync_status);
      } else if (!options?.silent) {
        setError("Failed to load document");
        setDocument(null);
      }
      setLoading(false);
    }
  }, [documentId, online, session.userId, workspaceId]);

  useEffect(() => {
    void refresh();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    if (!documentId) return;
    return subscribeSyncEngine((event) => {
      if (event.documentId !== documentId || !event.status) return;
      setSyncStatus(event.status);
      if (event.status === "synced" && event.type === "status") {
        void getOfflineDocument(documentId).then((row) => {
          if (!row) return;
          serverUpdatedAtRef.current = row.server_updated_at;
          setDocument((prev) =>
            prev
              ? {
                  ...prev,
                  title: row.title,
                  content: row.content,
                  content_plain: row.content_plain,
                  metadata: row.metadata,
                  updated_at: row.updated_at,
                }
              : prev,
          );
        });
      }
    });
  }, [documentId]);

  const save = useCallback(
    async (patch: DocumentPatch) => {
      if (!documentId) return null;

      let prev = documentRef.current;
      if (!prev) {
        try {
          const cached = await getOfflineDocument(documentId);
          if (cached) {
            prev = recordFromOffline(cached);
            documentRef.current = prev;
          }
        } catch {
          /* IndexedDB unavailable */
        }
      }

      if (!prev) {
        if (!online) {
          return null;
        }
        const response = await fetch(`/app/api/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return null;
        const next = data.document as DocumentRecord;
        setDocument(next);
        documentRef.current = next;
        serverUpdatedAtRef.current = next.updated_at;
        return next;
      }

      const safePatch = withoutRegressiveContentPatch(prev, patch);
      const nextLocal: DocumentRecord = { ...prev, ...safePatch };

      setDocument(nextLocal);
      documentRef.current = nextLocal;

      const expectedUpdatedAt =
        serverUpdatedAtRef.current || prev.updated_at;

      try {
        if (!session.userId) {
          throw new Error("Cannot save offline: no userId for docs vault");
        }
        const persist = (async () => {
          await ensureDocsVaultUnlocked(session.userId!);
          await commitOfflineDocumentUpdate({
            document: toOfflineDocumentRecord({
              id: nextLocal.id,
              workspace_id: nextLocal.workspace_id,
              title: nextLocal.title,
              content: nextLocal.content,
              content_plain: nextLocal.content_plain,
              metadata: nextLocal.metadata,
              updated_at: new Date().toISOString(),
              created_at: nextLocal.created_at,
              server_updated_at: expectedUpdatedAt,
              sync_status: "pending",
            }),
            patch: safePatch,
            expectedUpdatedAt,
          });
          const repaired = await repairPendingStatusFromOutbox(documentId);
          if (repaired.includes(documentId)) {
            notifyDocumentSyncStatus(documentId, "pending");
          }
          setSyncStatus("pending");
          notifyDocumentSyncStatus(documentId, "pending");
        })();
        trackPendingDocumentSave(persist);
        await persist;
      } catch (error) {
        // Never fall back to direct PATCH — that masks empty IndexedDB.
        logCacheError("local save failed", error);
        return null;
      }

      if (online) {
        let pushResult = await pushOutbox();
        for (let attempt = 0; attempt < 6; attempt++) {
          const pending = await getOutboxForDocument(documentId);
          if (pending.length === 0) break;
          if (pushResult.stoppedOnNetwork) break;
          pushResult = await pushOutbox();
        }

        const synced = await getOfflineDocument(documentId);
        if (synced?.sync_status === "synced") {
          serverUpdatedAtRef.current = synced.server_updated_at;
          const next = recordFromOffline(synced);
          setDocument(next);
          documentRef.current = next;
          setSyncStatus("synced");
          return next;
        }
      }

      return nextLocal;
    },
    [documentId, online, session.userId],
  );

  const applyLocal = useCallback(
    (
      patch:
        | {
            title?: string;
            content?: Record<string, unknown> | null;
            content_plain?: string | null;
            metadata?: Record<string, unknown> | null;
          }
        | ((
            prev: DocumentRecord,
          ) => {
            title?: string;
            content?: Record<string, unknown> | null;
            content_plain?: string | null;
            metadata?: Record<string, unknown> | null;
          }),
    ) => {
      setDocument((prev) => {
        if (!prev) return prev;
        const resolved = typeof patch === "function" ? patch(prev) : patch;
        const next = { ...prev, ...resolved };
        documentRef.current = next;
        return next;
      });
    },
    [],
  );

  return {
    document,
    loading,
    error,
    refresh,
    save,
    applyLocal,
    syncStatus,
  };
}
