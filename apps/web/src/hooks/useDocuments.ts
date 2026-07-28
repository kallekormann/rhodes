"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentFilter } from "@/lib/documents/schemas";
import type { DocumentRecord } from "@/hooks/useDocument";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getOfflineDocument,
  listMergeableOfflineDocumentsForWorkspace,
  listOfflineDocumentSummariesForWorkspace,
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
  subscribeSyncEngine,
} from "@/lib/offline/sync-engine";
import {
  subscribeWorkspaceSync,
  type WorkspaceSyncState,
} from "@/lib/offline/workspace-sync";
import { bodyRichness } from "@/lib/offline/document-body";

type DocumentsListCacheEntry = {
  documents: DocumentRecord[];
  offlineSource: boolean;
  fetchedAt: number;
};

const documentsListCache = new Map<string, DocumentsListCacheEntry>();

function documentsListCacheKey(
  workspaceId: string,
  filter: DocumentFilter,
): string {
  return `${workspaceId}:${filter}`;
}

function readDocumentsListCache(
  workspaceId: string | null,
  filter: DocumentFilter,
): DocumentsListCacheEntry | undefined {
  if (!workspaceId) return undefined;
  return documentsListCache.get(documentsListCacheKey(workspaceId, filter));
}

function writeDocumentsListCache(
  workspaceId: string,
  filter: DocumentFilter,
  entry: Omit<DocumentsListCacheEntry, "fetchedAt">,
): void {
  documentsListCache.set(documentsListCacheKey(workspaceId, filter), {
    ...entry,
    fetchedAt: Date.now(),
  });
}

async function mergePendingLocalDocuments(
  workspaceId: string,
  userId: string | null | undefined,
  serverDocs: DocumentRecord[],
): Promise<DocumentRecord[]> {
  if (!userId) return serverDocs;

  try {
    await ensureDocsVaultUnlocked(userId);
    const cached = await listMergeableOfflineDocumentsForWorkspace(workspaceId);
    const serverById = new Map(serverDocs.map((doc) => [doc.id, doc]));
    const merged = [...serverDocs];

    for (const local of cached) {
      const localDoc = offlineRecordToDocument(local);
      const server = serverById.get(local.id);

      if (!server) {
        if (
          isLocalOnlyDocument(local) ||
          local.sync_status === "pending" ||
          local.sync_status === "conflict"
        ) {
          merged.unshift(localDoc);
        }
        continue;
      }

      const localRich = bodyRichness(local.content, local.content_plain);
      const serverHasBody =
        server.content != null || server.content_plain != null;
      const serverRich = serverHasBody
        ? bodyRichness(server.content, server.content_plain)
        : 0;
      if (
        local.sync_status === "pending" ||
        local.sync_status === "conflict" ||
        (serverHasBody && localRich > serverRich)
      ) {
        const index = merged.findIndex((doc) => doc.id === local.id);
        if (index >= 0) merged[index] = localDoc;
      }
    }

    return merged;
  } catch {
    return serverDocs;
  }
}

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
  const cachedList = readDocumentsListCache(workspaceId, filter);
  const [documents, setDocuments] = useState<DocumentRecord[]>(
    () => cachedList?.documents ?? [],
  );
  const [loading, setLoading] = useState(
    () => !cachedList && Boolean(workspaceId),
  );
  const [error, setError] = useState<string | null>(null);
  const [offlineSource, setOfflineSource] = useState(
    () => cachedList?.offlineSource ?? false,
  );
  const [workspaceSync, setWorkspaceSync] = useState<WorkspaceSyncState>({
    active: false,
    documentTitle: null,
    pendingCount: 0,
    pendingTitles: [],
  });

  const refreshGeneration = useRef(0);
  const documentsRef = useRef(documents);
  documentsRef.current = documents;

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setDocuments([]);
      setLoading(false);
      setOfflineSource(false);
      return;
    }

    const generation = ++refreshGeneration.current;

    const browserOffline =
      typeof navigator !== "undefined" && !navigator.onLine;

    if (!online || browserOffline) {
      setError(null);
      try {
        if (userId) await ensureDocsVaultUnlocked(userId);
        const cached = await listOfflineDocumentSummariesForWorkspace(workspaceId);
        if (generation !== refreshGeneration.current) return;
        setDocuments(cached.map(offlineRecordToDocument));
        setOfflineSource(true);
        writeDocumentsListCache(workspaceId, filter, {
          documents: cached.map(offlineRecordToDocument),
          offlineSource: true,
        });
      } catch {
        if (generation !== refreshGeneration.current) return;
        setError("Failed to load offline documents");
        setDocuments([]);
        setOfflineSource(false);
      }
      setLoading(false);
      return;
    }

    const showLoadingState = documentsRef.current.length === 0;
    if (showLoadingState) {
      setLoading(true);
    }
    setError(null);
    setOfflineSource(false);

    const params = new URLSearchParams({
      workspace_id: workspaceId,
      filter,
      include_body: "false",
    });

    try {
      const fetchOptions: RequestInit = {};
      if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
        fetchOptions.signal = AbortSignal.timeout(8_000);
      }
      const response = await fetch(`/app/api/documents?${params}`, fetchOptions);
      if (generation !== refreshGeneration.current) return;

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load documents");
        setDocuments([]);
        setLoading(false);
        return;
      }

      const serverDocs = (data.documents as DocumentRecord[]) ?? [];
      const merged = await mergePendingLocalDocuments(
        workspaceId,
        userId,
        serverDocs,
      );
      if (generation !== refreshGeneration.current) return;
      setDocuments(merged);
      writeDocumentsListCache(workspaceId, filter, {
        documents: merged,
        offlineSource: false,
      });
    } catch {
      if (generation !== refreshGeneration.current) return;
      try {
        if (userId) await ensureDocsVaultUnlocked(userId);
        const cached = await listOfflineDocumentSummariesForWorkspace(workspaceId);
        if (generation !== refreshGeneration.current) return;
        setDocuments(cached.map(offlineRecordToDocument));
        setOfflineSource(true);
        setError(null);
        if (workspaceId) {
          writeDocumentsListCache(workspaceId, filter, {
            documents: cached.map(offlineRecordToDocument),
            offlineSource: true,
          });
        }
      } catch {
        setError("Failed to load documents");
        setDocuments([]);
        setOfflineSource(false);
      }
    } finally {
      if (generation === refreshGeneration.current) {
        setLoading(false);
      }
    }
  }, [workspaceId, filter, online, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onOffline = () => {
      refreshGeneration.current += 1;
      void refresh();
    };
    const onOnline = () => {
      refreshGeneration.current += 1;
      void refresh();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  useEffect(() => {
    return subscribeWorkspaceSync(setWorkspaceSync);
  }, []);

  useEffect(() => {
    return subscribeSyncEngine((event) => {
      if (event.type === "drained") {
        void refresh();
      }
    });
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
    workspaceSync,
    refresh,
    createDocument,
    updateDocument,
    deleteDocument,
  };
}
