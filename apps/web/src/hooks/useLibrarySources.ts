"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LibrarySourceRecord } from "@/lib/library/schemas";

export function useLibrarySources(workspaceId: string | null) {
  const [sources, setSources] = useState<LibrarySourceRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const needsPoll = sources.some(
      (source) =>
        source.embedding_status === "pending" ||
        source.embedding_status === "processing",
    );

    if (!needsPoll) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (pollRef.current) return;

    pollRef.current = setInterval(() => {
      void refresh();
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
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

      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  return {
    sources,
    loading,
    error,
    uploading,
    refresh,
    uploadFiles,
    retrySource,
  };
}
