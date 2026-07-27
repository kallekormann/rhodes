"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { isDocumentId } from "@/lib/documents/ids";
import type { DocumentShareContext } from "@/lib/documents/share-context";
import {
  getOfflineDocument,
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { commitOfflineDocumentPatch } from "@/lib/offline/offline-document-patch";
import {
  ensureDocsVaultUnlocked,
} from "@/lib/offline/offline-vault-session";
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
import type { OfflineSyncStatus } from "@/lib/offline/db";

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

export function useDocument(
  documentId: string | null,
  online: boolean = true,
) {
  const { session } = useApp();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(documentId));
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus | null>(null);
  const serverUpdatedAtRef = useRef<string | null>(null);
  const documentRef = useRef<DocumentRecord | null>(null);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!documentId || !isDocumentId(documentId)) {
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

    let cached: Awaited<ReturnType<typeof getOfflineDocument>> = null;
    try {
      cached = await getOfflineDocument(documentId);
    } catch {
      cached = null;
    }

    if (
      cached &&
      (cached.sync_status === "pending" || cached.sync_status === "conflict")
    ) {
      setDocument(recordFromOffline(cached));
      serverUpdatedAtRef.current =
        cached.server_updated_at || cached.updated_at;
      setSyncStatus(cached.sync_status);
      if (!options?.silent) setLoading(false);
    }

    if (!online) {
      if (cached) {
        setDocument(recordFromOffline(cached));
        serverUpdatedAtRef.current =
          cached.server_updated_at || cached.updated_at;
        setSyncStatus(cached.sync_status);
      } else if (!options?.silent) {
        setError("Document not available offline");
        setDocument(null);
      }
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/app/api/documents/${documentId}`);
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
              await ensureDocsVaultUnlocked(session.userId);
            }
            await putOfflineDocument(
              toOfflineDocumentRecord({
                ...remote,
                server_updated_at: remote.updated_at,
                sync_status: "synced",
              }),
            );
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
          return;
        }
      }

      setDocument(remote);
      serverUpdatedAtRef.current = remote.updated_at;
      setSyncStatus("synced");

      try {
        if (session.userId) {
          await ensureDocsVaultUnlocked(session.userId);
        } else {
          throw new Error("Cannot cache document: no userId for docs vault");
        }
        await putOfflineDocument(
          toOfflineDocumentRecord({
            ...remote,
            server_updated_at: remote.updated_at,
            sync_status: "synced",
          }),
        );
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
  }, [documentId, online, session.userId]);

  useEffect(() => {
    void refresh();
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

      const nextLocal: DocumentRecord = { ...prev, ...patch };

      setDocument(nextLocal);
      documentRef.current = nextLocal;

      const expectedUpdatedAt =
        serverUpdatedAtRef.current || prev.updated_at;

      try {
        if (!session.userId) {
          throw new Error("Cannot save offline: no userId for docs vault");
        }
        await ensureDocsVaultUnlocked(session.userId);
        await commitOfflineDocumentPatch({
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
          patch,
          expectedUpdatedAt,
        });
        const repaired = await repairPendingStatusFromOutbox(documentId);
        if (repaired.includes(documentId)) {
          notifyDocumentSyncStatus(documentId, "pending");
        }
        setSyncStatus("pending");
        notifyDocumentSyncStatus(documentId, "pending");
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
