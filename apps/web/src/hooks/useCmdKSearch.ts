"use client";

import { useEffect, useState } from "react";

export type CmdKDocumentHit = {
  id: string;
  title: string;
};

export type CmdKLibraryHit = {
  id: string;
  file_name: string;
};

type UseCmdKSearchResult = {
  query: string;
  setQuery: (value: string) => void;
  documents: CmdKDocumentHit[];
  library: CmdKLibraryHit[];
  loading: boolean;
};

const DOC_LIMIT = 8;
const LIBRARY_LIMIT = 6;

export function useCmdKSearch(
  workspaceId: string | null,
  enabled: boolean,
): UseCmdKSearchResult {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [documents, setDocuments] = useState<CmdKDocumentHit[]>([]);
  const [library, setLibrary] = useState<CmdKLibraryHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setQuery("");
      setDebounced("");
      setDocuments([]);
      setLibrary([]);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setDebounced(query.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [query, enabled]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;

    const controller = new AbortController();
    const q = debounced;
    setLoading(true);

    void (async () => {
      try {
        const docsParams = new URLSearchParams({
          workspace_id: workspaceId,
          limit: String(DOC_LIMIT),
        });
        if (q) {
          docsParams.set("filter", "all");
          docsParams.set("q", q);
        } else {
          docsParams.set("filter", "recent");
        }

        const docsPromise = fetch(`/app/api/documents?${docsParams}`, {
          signal: controller.signal,
        }).then(async (response) => {
          if (!response.ok) return [] as CmdKDocumentHit[];
          const data = (await response.json()) as {
            documents?: Array<{ id: string; title?: string | null }>;
          };
          return (data.documents ?? [])
            .map((doc) => ({
              id: doc.id,
              title: (doc.title ?? "").trim() || "Untitled",
            }))
            .slice(0, DOC_LIMIT);
        });

        const libraryPromise =
          q.length > 0
            ? fetch(
                `/app/api/library?workspace_id=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(q)}&limit=${LIBRARY_LIMIT}`,
                { signal: controller.signal },
              ).then(async (response) => {
                if (!response.ok) return [] as CmdKLibraryHit[];
                const data = (await response.json()) as {
                  sources?: Array<{ id: string; file_name?: string | null }>;
                };
                return (data.sources ?? []).map((source) => ({
                  id: source.id,
                  file_name: (source.file_name ?? "").trim() || "Untitled file",
                }));
              })
            : Promise.resolve([] as CmdKLibraryHit[]);

        const [docs, lib] = await Promise.all([docsPromise, libraryPromise]);
        if (controller.signal.aborted) return;
        setDocuments(docs);
        setLibrary(lib);
      } catch {
        if (controller.signal.aborted) return;
        setDocuments([]);
        setLibrary([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [workspaceId, debounced, enabled]);

  return { query, setQuery, documents, library, loading };
}
