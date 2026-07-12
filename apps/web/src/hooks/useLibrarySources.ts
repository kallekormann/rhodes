"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LibrarySourceRecord } from "@/lib/library/schemas";
import { toLibrarySourceRecord, upsertLibrarySource } from "@/lib/library/realtime";

export function useLibrarySources(workspaceId: string | null) {
  const [sources, setSources] = useState<LibrarySourceRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [live, setLive] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const fallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const markDeleting = useCallback((sourceId: string) => {
    setDeletingIds((current) =>
      current.includes(sourceId) ? current : [...current, sourceId],
    );
  }, []);

  const unmarkDeleting = useCallback((sourceId: string) => {
    setDeletingIds((current) => current.filter((id) => id !== sourceId));
  }, []);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setSources([]);
      setLoading(false);
      return;
    }

    setError(null);

    const params = new URLSearchParams({ workspace_id: workspaceId });
    const response = await fetch(`/app/api/library?${params}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(
        typeof data.error === "string" ? data.error : "Failed to load library sources",
      );
      setSources([]);
      setLoading(false);
      return;
    }

    setSources((data.sources as LibrarySourceRecord[]) ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    setLoading(Boolean(workspaceId));
    void refresh();
  }, [refresh, workspaceId]);

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
            return;
          }

          const record = toLibrarySourceRecord(
            payload.new as Record<string, unknown>,
          );
          if (!record) return;
          setSources((current) => upsertLibrarySource(current, record));
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  useEffect(() => {
    const indexing = sources.some(
      (source) =>
        source.embedding_status === "pending" ||
        source.embedding_status === "processing",
    );

    if (!indexing) {
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
        fallbackPollRef.current = null;
      }
      return;
    }

    if (fallbackPollRef.current) return;

    // Poll while indexing — Realtime may not deliver in local Docker setups.
    fallbackPollRef.current = setInterval(() => {
      void refresh();
    }, 3000);

    return () => {
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
        fallbackPollRef.current = null;
      }
    };
  }, [refresh, sources]);

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

        await refresh();
        return { ok: true as const };
      } finally {
        setUploading(false);
      }
    },
    [refresh, workspaceId],
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

      const record = toLibrarySourceRecord(
        (data.source as Record<string, unknown>) ?? {},
      );
      if (record) {
        setSources((current) => upsertLibrarySource(current, record));
      } else {
        await refresh();
      }

      return { ok: true as const };
    },
    [refresh],
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
      setSources((current) => current.filter((source) => source.id !== sourceId));
      return { ok: true as const };
    },
    [markDeleting, unmarkDeleting],
  );

  return {
    sources,
    loading,
    error,
    uploading,
    live,
    deletingIds,
    refresh,
    uploadFiles,
    retrySource,
    deleteSource,
  };
}
