"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentFilter } from "@/lib/documents/schemas";
import type { DocumentRecord } from "@/hooks/useDocument";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getOfflineDocument,
  listOfflineDocumentsForWorkspace,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { createLocalDocumentId, isLocalOnlyDocument } from "@/lib/offline/local-document";
import {
  buildOfflineCreateDocument,
  commitOfflineDocumentCreate,
  commitOfflineDocumentDelete,
  commitOfflineDocumentUpdate,
} from "@/lib/offline/offline-document-mutations";
import { ensureDocsVaultUnlocked } from "@/lib/offline/offline-vault-session";
import { repairPendingStatusFromOutbox } from "@/lib/offline/offline-sync-status";
import {
  notifyDocumentSyncStatus,
} from "@/lib/offline/sync-engine";

function offlineRecordToDocument(record: {
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
    id: record.id,
    workspace_id: record.workspace_id,
    title: record.title,
    content: record.content,
    content_plain: record.content_plain,
    metadata: record.metadata ?? null,
    updated_at: record.updated_at,
    created_at: record.created_at,
  };
}

async function patchDocumentById(
  id: string,
  patch: {
    title?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const response = await fetch(`/app/api/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Update failed");
  }
  return data.document as DocumentRecord;
}

export function useDocuments(
  workspaceId: string | null,
  filter: DocumentFilter = "recent",
  userId?: string | null,
) {
  const { online } = useOnlineStatus(workspaceId);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);
  const [offlineSource, setOfflineSource] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setDocuments([]);
      setLoading(false);
      setOfflineSource(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (!online) {
      try {
        const cached = await listOfflineDocumentsForWorkspace(workspaceId);
        setDocuments(cached.map(offlineRecordToDocument));
        setOfflineSource(true);
      } catch {
        setError("Failed to load offline documents");
        setDocuments([]);
        setOfflineSource(false);
      }
      setLoading(false);
      return;
    }

    setOfflineSource(false);

    const params = new URLSearchParams({
      workspace_id: workspaceId,
      filter,
    });

    const response = await fetch(`/app/api/documents?${params}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to load documents");
      setDocuments([]);
      setLoading(false);
      return;
    }

    setDocuments((data.documents as DocumentRecord[]) ?? []);
    setLoading(false);
  }, [workspaceId, filter, online]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createDocument = useCallback(
    async (
      input?: {
        title?: string;
        template_id?: string;
        metadata?: Record<string, unknown>;
      },
      workspaceOverride?: string,
    ) => {
      const targetWorkspaceId = workspaceOverride ?? workspaceId;
      if (!targetWorkspaceId) return null;

      if (!online) {
        if (input?.template_id) {
          setError("Templates require an internet connection");
          return null;
        }
        if (!userId) {
          setError("Cannot create document offline");
          return null;
        }

        try {
          await ensureDocsVaultUnlocked(userId);
          const id = createLocalDocumentId();
          const { document, create } = await buildOfflineCreateDocument({
            id,
            workspaceId: targetWorkspaceId,
            title: input?.title,
            metadata: input?.metadata,
          });
          await commitOfflineDocumentCreate({ document, create });
          const created = offlineRecordToDocument(document);
          setDocuments((prev) => [created, ...prev]);
          notifyDocumentSyncStatus(id, "pending");
          return created;
        } catch {
          setError("Failed to create document offline");
          return null;
        }
      }

      const response = await fetch("/app/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: targetWorkspaceId,
          title: input?.title,
          template_id: input?.template_id,
          metadata: input?.metadata,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to create document");
        return null;
      }

      const created = data.document as DocumentRecord;
      setDocuments((prev) => [created, ...prev]);
      return created;
    },
    [workspaceId, online, userId],
  );

  const updateDocument = useCallback(
    async (
      id: string,
      patch: { title?: string; metadata?: Record<string, unknown> },
    ) => {
      if (!online) {
        if (!userId) {
          setError("Cannot update document offline");
          return null;
        }

        try {
          await ensureDocsVaultUnlocked(userId);
          const cached = await getOfflineDocument(id);
          if (!cached) {
            setError("Document not available offline");
            return null;
          }

          const updatedAt = new Date().toISOString();
          const nextLocal = offlineRecordToDocument({
            ...cached,
            ...patch,
            metadata:
              patch.metadata !== undefined
                ? patch.metadata
                : (cached.metadata ?? null),
            updated_at: updatedAt,
          });

          await commitOfflineDocumentUpdate({
            document: toOfflineDocumentRecord({
              ...cached,
              title: nextLocal.title,
              metadata: nextLocal.metadata,
              updated_at: updatedAt,
              sync_status: "pending",
            }),
            patch,
            expectedUpdatedAt: cached.server_updated_at,
          });
          await repairPendingStatusFromOutbox(id);
          notifyDocumentSyncStatus(id, "pending");
          setDocuments((prev) =>
            prev.map((doc) => (doc.id === id ? nextLocal : doc)),
          );
          return nextLocal;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Update failed");
          return null;
        }
      }

      try {
        const updated = await patchDocumentById(id, patch);
        setDocuments((prev) => prev.map((doc) => (doc.id === id ? updated : doc)));
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
        return null;
      }
    },
    [online, userId],
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      if (!online) {
        if (!userId) {
          setError("Cannot delete document offline");
          return false;
        }

        try {
          await ensureDocsVaultUnlocked(userId);
          const cached = await getOfflineDocument(id);
          const localOnly = cached ? isLocalOnlyDocument(cached) : false;
          await commitOfflineDocumentDelete({
            documentId: id,
            serverUpdatedAt: cached?.server_updated_at ?? "",
            localOnly,
          });
          setDocuments((prev) => prev.filter((doc) => doc.id !== id));
          return true;
        } catch {
          setError("Failed to delete document offline");
          return false;
        }
      }

      const response = await fetch(`/app/api/documents/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Delete failed");
        return false;
      }
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      return true;
    },
    [online, userId],
  );

  return {
    documents,
    loading,
    error,
    offlineSource,
    refresh,
    createDocument,
    updateDocument,
    deleteDocument,
  };
}
