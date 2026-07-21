"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  LibraryFileTypeFilter,
  LibraryListFilters,
  LibrarySourceRecord,
} from "@/lib/library/schemas";
import { librarySourceIsInFlight } from "@/lib/library/pipeline";
import { toLibrarySourceRecord, upsertLibrarySource } from "@/lib/library/realtime";

export const LIBRARY_PAGE_SIZE = 20;

export type LibraryQueryState = {
  q: string;
  fileType: LibraryFileTypeFilter;
  from: string | null;
  to: string | null;
  offset: number;
};

type PageCacheEntry = {
  sources: LibrarySourceRecord[];
  total: number;
};

function cacheKey(workspaceId: string, query: LibraryQueryState): string {
  return [
    workspaceId,
    query.q.trim().toLowerCase(),
    query.fileType,
    query.from ?? "",
    query.to ?? "",
    String(query.offset),
  ].join("|");
}

function filtersKey(workspaceId: string, query: Omit<LibraryQueryState, "offset">): string {
  return [
    workspaceId,
    query.q.trim().toLowerCase(),
    query.fileType,
    query.from ?? "",
    query.to ?? "",
  ].join("|");
}

function buildParams(workspaceId: string, query: LibraryQueryState): URLSearchParams {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    limit: String(LIBRARY_PAGE_SIZE),
    offset: String(query.offset),
  });
  if (query.q.trim()) params.set("q", query.q.trim());
  if (query.fileType !== "all") params.set("file_type", query.fileType);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  return params;
}

async function fetchLibraryPage(
  workspaceId: string,
  query: LibraryQueryState,
): Promise<{ sources: LibrarySourceRecord[]; total: number }> {
  const response = await fetch(`/app/api/library?${buildParams(workspaceId, query)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to load library sources",
    );
  }
  return {
    sources: (data.sources as LibrarySourceRecord[]) ?? [],
    total: typeof data.total === "number" ? data.total : 0,
  };
}

const DEFAULT_QUERY: LibraryQueryState = {
  q: "",
  fileType: "all",
  from: null,
  to: null,
  offset: 0,
};

export function useLibrarySources(workspaceId: string | null) {
  const [query, setQuery] = useState<LibraryQueryState>(DEFAULT_QUERY);
  const [sources, setSources] = useState<LibrarySourceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [live, setLive] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const fallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pageCacheRef = useRef<Map<string, PageCacheEntry>>(new Map());
  const queryRef = useRef(query);
  queryRef.current = query;

  const clearPageCache = useCallback(() => {
    pageCacheRef.current.clear();
  }, []);

  const markDeleting = useCallback((sourceId: string) => {
    setDeletingIds((current) =>
      current.includes(sourceId) ? current : [...current, sourceId],
    );
  }, []);

  const unmarkDeleting = useCallback((sourceId: string) => {
    setDeletingIds((current) => current.filter((id) => id !== sourceId));
  }, []);

  const applyPage = useCallback((page: PageCacheEntry, offset: number) => {
    setSources(page.sources);
    setTotal(page.total);
    setQuery((current) =>
      current.offset === offset ? current : { ...current, offset },
    );
  }, []);

  const loadPage = useCallback(
    async (
      nextQuery: LibraryQueryState,
      options?: { silent?: boolean; preferCache?: boolean },
    ) => {
      if (!workspaceId) {
        setSources([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      const key = cacheKey(workspaceId, nextQuery);
      if (options?.preferCache) {
        const cached = pageCacheRef.current.get(key);
        if (cached) {
          applyPage(cached, nextQuery.offset);
          setLoading(false);
          // Revalidate in background
          void fetchLibraryPage(workspaceId, nextQuery)
            .then((page) => {
              pageCacheRef.current.set(key, page);
              if (
                queryRef.current.offset === nextQuery.offset &&
                filtersKey(workspaceId, queryRef.current) ===
                  filtersKey(workspaceId, nextQuery)
              ) {
                applyPage(page, nextQuery.offset);
              }
            })
            .catch(() => {});
          return;
        }
      }

      if (!options?.silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const page = await fetchLibraryPage(workspaceId, nextQuery);
        pageCacheRef.current.set(key, page);

        const sameFilters =
          filtersKey(workspaceId, queryRef.current) ===
          filtersKey(workspaceId, nextQuery);
        const sameOffset = queryRef.current.offset === nextQuery.offset;

        if (!options?.silent || (sameFilters && sameOffset)) {
          if (sameFilters) {
            setSources(page.sources);
            setTotal(page.total);
            setQuery((current) => ({ ...current, offset: nextQuery.offset }));
          }
        }

        // Prefetch next page
        if (nextQuery.offset + LIBRARY_PAGE_SIZE < page.total) {
          const prefetchQuery = {
            ...nextQuery,
            offset: nextQuery.offset + LIBRARY_PAGE_SIZE,
          };
          const prefetchKey = cacheKey(workspaceId, prefetchQuery);
          if (!pageCacheRef.current.has(prefetchKey)) {
            void fetchLibraryPage(workspaceId, prefetchQuery)
              .then((prefetchPage) => {
                pageCacheRef.current.set(prefetchKey, prefetchPage);
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : "Failed to load library sources");
          setSources([]);
          setTotal(0);
        }
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [applyPage, workspaceId],
  );

  const refresh = useCallback(async () => {
    clearPageCache();
    await loadPage(queryRef.current);
  }, [clearPageCache, loadPage]);

  useEffect(() => {
    setQuery(DEFAULT_QUERY);
    clearPageCache();
    setLoading(Boolean(workspaceId));
    if (!workspaceId) {
      setSources([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    void loadPage({ ...DEFAULT_QUERY });
  }, [workspaceId, clearPageCache, loadPage]);

  useEffect(() => {
    if (!workspaceId) {
      setLive(false);
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`library-sources:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "library_sources",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id =
              typeof payload.old.id === "string" ? payload.old.id : null;
            if (!id) return;
            setSources((current) => current.filter((source) => source.id !== id));
            setTotal((current) => Math.max(0, current - 1));
            clearPageCache();
            return;
          }

          if (payload.eventType === "INSERT") {
            clearPageCache();
            if (queryRef.current.offset === 0) {
              void loadPage({ ...queryRef.current, offset: 0 }, { silent: true });
            }
            return;
          }

          const record = toLibrarySourceRecord(
            payload.new as Record<string, unknown>,
          );
          if (!record) return;
          setSources((current) => {
            if (!current.some((s) => s.id === record.id)) return current;
            return upsertLibrarySource(current, record);
          });
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, clearPageCache, loadPage]);

  useEffect(() => {
    const indexing = sources.some((source) => librarySourceIsInFlight(source));

    if (!indexing) {
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
        fallbackPollRef.current = null;
      }
      return;
    }

    if (fallbackPollRef.current) return;

    fallbackPollRef.current = setInterval(() => {
      void loadPage(queryRef.current, { silent: true });
    }, 3000);

    return () => {
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
        fallbackPollRef.current = null;
      }
    };
  }, [loadPage, sources]);

  const setFilters = useCallback(
    (patch: Partial<LibraryListFilters>) => {
      const next: LibraryQueryState = {
        q: patch.q ?? queryRef.current.q,
        fileType: patch.fileType ?? queryRef.current.fileType,
        from: patch.from !== undefined ? patch.from : queryRef.current.from,
        to: patch.to !== undefined ? patch.to : queryRef.current.to,
        offset: 0,
      };
      clearPageCache();
      setQuery(next);
      void loadPage(next);
    },
    [clearPageCache, loadPage],
  );

  const goToOffset = useCallback(
    (offset: number) => {
      const next = { ...queryRef.current, offset: Math.max(0, offset) };
      setQuery(next);
      void loadPage(next, { preferCache: true });
    },
    [loadPage],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!workspaceId || files.length === 0) return { ok: false as const };

      setUploading(true);
      setError(null);

      try {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("workspace_id", workspaceId);

          const response = await fetch("/app/api/library/upload", {
            method: "POST",
            body: formData,
          });

          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message =
              typeof data.error === "string" ? data.error : "Upload failed";
            setError(message);
            return { ok: false as const, error: message };
          }
        }

        clearPageCache();
        await loadPage({ ...queryRef.current, offset: 0 });
        return { ok: true as const };
      } finally {
        setUploading(false);
      }
    },
    [clearPageCache, loadPage, workspaceId],
  );

  const replaceSource = useCallback(
    async (sourceId: string, file: File) => {
      if (!workspaceId) return { ok: false as const, error: "No workspace" };

      setUploading(true);
      setError(null);
      try {
        const deleteResponse = await fetch(`/app/api/library/${sourceId}`, {
          method: "DELETE",
        });
        if (!deleteResponse.ok) {
          const data = await deleteResponse.json().catch(() => ({}));
          const message =
            typeof data.error === "string" ? data.error : "Failed to remove source";
          setError(message);
          return { ok: false as const, error: message };
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("workspace_id", workspaceId);
        const uploadResponse = await fetch("/app/api/library/upload", {
          method: "POST",
          body: formData,
        });
        const data = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) {
          const message =
            typeof data.error === "string" ? data.error : "Upload failed";
          setError(message);
          return { ok: false as const, error: message };
        }

        clearPageCache();
        await loadPage({ ...queryRef.current, offset: 0 });
        return { ok: true as const };
      } finally {
        setUploading(false);
      }
    },
    [clearPageCache, loadPage, workspaceId],
  );

  const retrySource = useCallback(
    async (sourceId: string) => {
      const response = await fetch(`/app/api/library/${sourceId}/retry`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Retry failed";
        setError(message);
        return { ok: false as const, error: message };
      }

      clearPageCache();
      const record = toLibrarySourceRecord(
        (data.source as Record<string, unknown>) ?? {},
      );
      if (record) {
        setSources((current) => upsertLibrarySource(current, record));
      } else {
        await loadPage(queryRef.current, { silent: true });
      }

      return { ok: true as const };
    },
    [clearPageCache, loadPage],
  );

  const deleteSource = useCallback(
    async (sourceId: string) => {
      markDeleting(sourceId);

      const response = await fetch(`/app/api/library/${sourceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        unmarkDeleting(sourceId);
        const data = await response.json().catch(() => ({}));
        const message =
          typeof data.error === "string" ? data.error : "Failed to remove source";
        setError(message);
        return { ok: false as const, error: message };
      }

      unmarkDeleting(sourceId);
      clearPageCache();
      setSources((current) => current.filter((source) => source.id !== sourceId));
      setTotal((current) => Math.max(0, current - 1));
      return { ok: true as const };
    },
    [clearPageCache, markDeleting, unmarkDeleting],
  );

  return {
    sources,
    total,
    loading,
    error,
    uploading,
    live,
    deletingIds,
    query,
    limit: LIBRARY_PAGE_SIZE,
    setFilters,
    goToOffset,
    refresh,
    uploadFiles,
    replaceSource,
    retrySource,
    deleteSource,
  };
}
