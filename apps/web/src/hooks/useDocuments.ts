"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentFilter } from "@/lib/documents/schemas";
import type { DocumentRecord } from "@/hooks/useDocument";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getOfflineDocument,
  listMergeableOfflineDocumentsForWorkspace,
  listOfflineDocumentSummariesForWorkspace,
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { notifyDocumentMetadataPatched } from "@/lib/documents/document-metadata-bus";
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
import { isCacheFresh } from "@/lib/cache/swr-cache";
import { markDocumentFresh } from "@/lib/documents/fresh-documents";

type DocumentsListCacheEntry = {
  documents: DocumentRecord[];
  offlineSource: boolean;
  fetchedAt: number;
};

const documentsListCache = new Map<string, DocumentsListCacheEntry>();

/** Board `filter=all` lists can be large; don't abort into a tiny offline fallback. */
const FETCH_TIMEOUT_MS: Record<DocumentFilter, number> = {
  all: 30_000,
  recent: 15_000,
  favorites: 15_000,
  archive: 15_000,
  shared: 20_000,
};

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

function scopeDocumentsToWorkspace(
  docs: DocumentRecord[],
  workspaceId: string,
  filter: DocumentFilter,
): DocumentRecord[] {
  // Shared tab intentionally includes docs owned by other workspaces.
  if (filter === "shared") return docs;
  return docs.filter((doc) => doc.workspace_id === workspaceId);
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
  const listKey = workspaceId
    ? documentsListCacheKey(workspaceId, filter)
    : null;
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
  const listKeyRef = useRef<string | null>(listKey);

  // Scope switch must never leave the previous workspace's rows on screen.
  useEffect(() => {
    if (listKeyRef.current === listKey) return;
    listKeyRef.current = listKey;
    refreshGeneration.current += 1;

    if (!workspaceId) {
      setDocuments([]);
      setLoading(false);
      setOfflineSource(false);
      setError(null);
      return;
    }

    const cached = readDocumentsListCache(workspaceId, filter);
    if (cached && !cached.offlineSource) {
      setDocuments(
        scopeDocumentsToWorkspace(cached.documents, workspaceId, filter),
      );
      setOfflineSource(false);
      setLoading(false);
    } else if (cached?.offlineSource) {
      setDocuments(
        scopeDocumentsToWorkspace(cached.documents, workspaceId, filter),
      );
      setOfflineSource(true);
      // Still treat as loading when online so we replace the offline subset.
      setLoading(online);
    } else {
      setDocuments([]);
      setOfflineSource(false);
      setLoading(true);
    }
    setError(null);
  }, [listKey, workspaceId, filter, online]);

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    if (!workspaceId) {
      setDocuments([]);
      setLoading(false);
      setOfflineSource(false);
      return;
    }

    const warm = readDocumentsListCache(workspaceId, filter);
    // Serve warm *online* cache for instant paint, then always revalidate.
    // Never treat an offline-timeout fallback as a complete online list.
    if (
      warm &&
      !options?.force &&
      online &&
      isCacheFresh(warm.fetchedAt) &&
      !warm.offlineSource
    ) {
      setDocuments(
        scopeDocumentsToWorkspace(warm.documents, workspaceId, filter),
      );
      setOfflineSource(false);
      setLoading(false);
      setError(null);
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
        const offlineDocs = scopeDocumentsToWorkspace(
          cached.map(offlineRecordToDocument),
          workspaceId,
          filter,
        );
        setDocuments(offlineDocs);
        setOfflineSource(true);
        writeDocumentsListCache(workspaceId, filter, {
          documents: offlineDocs,
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

    const scopedCurrent = scopeDocumentsToWorkspace(
      documentsRef.current,
      workspaceId,
      filter,
    );
    const showLoadingState =
      scopedCurrent.length === 0 && !(warm && !warm.offlineSource);
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
      const timeoutMs = FETCH_TIMEOUT_MS[filter] ?? 15_000;
      if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
        fetchOptions.signal = AbortSignal.timeout(timeoutMs);
      }
      const response = await fetch(`/app/api/documents?${params}`, fetchOptions);
      if (generation !== refreshGeneration.current) return;

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load documents");
        if (!(warm && !warm.offlineSource) && scopedCurrent.length === 0) {
          setDocuments([]);
        }
        setLoading(false);
        return;
      }

      const serverDocs = scopeDocumentsToWorkspace(
        (data.documents as DocumentRecord[]) ?? [],
        workspaceId,
        filter,
      );
      setDocuments(serverDocs);
      writeDocumentsListCache(workspaceId, filter, {
        documents: serverDocs,
        offlineSource: false,
      });
      setLoading(false);

      void mergePendingLocalDocuments(workspaceId, userId, serverDocs).then(
        (merged) => {
          if (generation !== refreshGeneration.current) return;
          const scoped = scopeDocumentsToWorkspace(merged, workspaceId, filter);
          setDocuments(scoped);
          writeDocumentsListCache(workspaceId, filter, {
            documents: scoped,
            offlineSource: false,
          });
        },
      );
    } catch {
      if (generation !== refreshGeneration.current) return;

      // Online request failed (timeout/network). Never replace a good online
      // list — or an empty loading state — with a tiny offline IDB subset.
      const warmOnline =
        warm && !warm.offlineSource
          ? scopeDocumentsToWorkspace(warm.documents, workspaceId, filter)
          : null;
      if (warmOnline && warmOnline.length > 0) {
        setDocuments(warmOnline);
        setOfflineSource(false);
        setError("Couldn't refresh documents");
        setLoading(false);
        return;
      }

      if (scopedCurrent.length > 0) {
        setDocuments(scopedCurrent);
        setOfflineSource(false);
        setError("Couldn't refresh documents");
        setLoading(false);
        return;
      }

      // No online data yet — show offline copy for UX, but do not write it into
      // the SWR cache as a successful online fetch (that poisoned boards).
      try {
        if (userId) await ensureDocsVaultUnlocked(userId);
        const cached = await listOfflineDocumentSummariesForWorkspace(workspaceId);
        if (generation !== refreshGeneration.current) return;
        const offlineDocs = scopeDocumentsToWorkspace(
          cached.map(offlineRecordToDocument),
          workspaceId,
          filter,
        );
        setDocuments(offlineDocs);
        setOfflineSource(offlineDocs.length > 0);
        // Empty cache after a failed online fetch is not "offline mode" —
        // treat as empty so first-run UI can guide the user, not scare them.
        setError(
          offlineDocs.length > 0
            ? "Couldn't reach the server — showing cached documents"
            : null,
        );
      } catch {
        setError("Failed to load documents");
        setDocuments([]);
        setOfflineSource(false);
      }
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
      void refresh({ force: true });
    };
    const onOnline = () => {
      refreshGeneration.current += 1;
      void refresh({ force: true });
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
        void refresh({ force: true });
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
          if (targetWorkspaceId === workspaceId) {
            setDocuments((prev) => [created, ...prev]);
          }
          notifyDocumentSyncStatus(id, "pending");
          markDocumentFresh(id);
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
      if (targetWorkspaceId === workspaceId) {
        setDocuments((prev) => [created, ...prev]);
      }
      markDocumentFresh(created.id);
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
          if (patch.metadata !== undefined) {
            notifyDocumentMetadataPatched({
              documentId: id,
              metadata: nextLocal.metadata,
              updated_at: nextLocal.updated_at,
            });
          }
          return nextLocal;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Update failed");
          return null;
        }
      }

      try {
        const updated = await patchDocumentById(id, patch);
        setDocuments((prev) => prev.map((doc) => (doc.id === id ? updated : doc)));
        if (patch.metadata !== undefined) {
          notifyDocumentMetadataPatched({
            documentId: id,
            metadata: updated.metadata ?? null,
            updated_at: updated.updated_at,
          });
          // Keep offline cache Origin/title in sync without clobbering richer body.
          if (userId) {
            void (async () => {
              try {
                await ensureDocsVaultUnlocked(userId);
                const cached = await getOfflineDocument(id);
                if (!cached) return;
                await putOfflineDocument(
                  toOfflineDocumentRecord({
                    ...cached,
                    title: updated.title || cached.title,
                    metadata: updated.metadata ?? null,
                    updated_at: updated.updated_at,
                    server_updated_at: updated.updated_at,
                  }),
                );
              } catch {
                /* IndexedDB unavailable */
              }
            })();
          }
        }
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

  const scopedDocuments = useMemo(() => {
    if (!workspaceId) return [];
    return scopeDocumentsToWorkspace(documents, workspaceId, filter);
  }, [documents, workspaceId, filter]);

  return {
    documents: scopedDocuments,
    loading,
    error,
    offlineSource,
    workspaceSync,
    refresh: () => refresh({ force: true }),
    createDocument,
    updateDocument,
    deleteDocument,
  };
}
