"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isDocumentId } from "@/lib/documents/ids";
import type { DocumentShareContext } from "@/lib/documents/share-context";
import {
  getOfflineDocument,
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { enqueueDocumentPatch } from "@/lib/offline/outbox";
import {
  pushOutbox,
  subscribeSyncEngine,
} from "@/lib/offline/sync-engine";
import type { OfflineSyncStatus } from "@/lib/offline/db";

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

export function useDocument(documentId: string | null) {
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

      if (
        cached &&
        (cached.sync_status === "pending" || cached.sync_status === "conflict")
      ) {
        // Prefer local pending/conflict over remote until resolved.
        setLoading(false);
        return;
      }

      setDocument(remote);
      serverUpdatedAtRef.current = remote.updated_at;
      setSyncStatus("synced");

      try {
        await putOfflineDocument(
          toOfflineDocumentRecord({
            ...remote,
            server_updated_at: remote.updated_at,
            sync_status: "synced",
          }),
        );
      } catch {
        // IndexedDB unavailable
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
  }, [documentId]);

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

      const prev = documentRef.current;
      if (!prev) {
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
        await putOfflineDocument(
          toOfflineDocumentRecord({
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
        );
        await enqueueDocumentPatch({
          documentId,
          patch,
          expectedUpdatedAt,
        });
        setSyncStatus("pending");
      } catch {
        const response = await fetch(`/app/api/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...patch,
            expected_updated_at: expectedUpdatedAt,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return null;
        const next = data.document as DocumentRecord;
        setDocument(next);
        documentRef.current = next;
        serverUpdatedAtRef.current = next.updated_at;
        setSyncStatus("synced");
        return next;
      }

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const result = await pushOutbox();
        const conflict = result.conflicts.find(
          (item) => item.documentId === documentId,
        );
        if (conflict) {
          setSyncStatus("conflict");
          return nextLocal;
        }
        if (result.pushed > 0) {
          const synced = await getOfflineDocument(documentId);
          if (synced) {
            serverUpdatedAtRef.current = synced.server_updated_at;
            const next = recordFromOffline(synced);
            setDocument(next);
            documentRef.current = next;
            setSyncStatus("synced");
            return next;
          }
        }
      }

      return nextLocal;
    },
    [documentId],
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
        return { ...prev, ...resolved };
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
