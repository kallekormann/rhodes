"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EnrichedActivityRecord } from "@/lib/documents/activity-display";

export function useDocumentActivity(documentId: string | null) {
  const [activity, setActivity] = useState<EnrichedActivityRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(documentId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!documentId) {
      setActivity([]);
      setLoading(false);
      return;
    }

    setError(null);
    const response = await fetch(`/app/api/documents/${documentId}/activity`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(
        typeof data.error === "string" ? data.error : "Failed to load activity",
      );
      setActivity([]);
      setLoading(false);
      return;
    }

    setActivity((data.activity as EnrichedActivityRecord[]) ?? []);
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    setLoading(Boolean(documentId));
    void refresh();
  }, [documentId, refresh]);

  useEffect(() => {
    if (!documentId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`document-activity:${documentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "document_activity",
          filter: `document_id=eq.${documentId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [documentId, refresh]);

  return { activity, loading, error, refresh };
}

export type DocumentVersionSummary = {
  id: string;
  document_id: string;
  workspace_id: string;
  changed_by: string | null;
  changed_by_name?: string | null;
  change_summary: string | null;
  created_at: string;
};

export function useDocumentVersions(documentId: string | null) {
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);
  const [loading, setLoading] = useState(Boolean(documentId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!documentId) {
      setVersions([]);
      setLoading(false);
      return;
    }

    setError(null);
    const response = await fetch(`/app/api/documents/${documentId}/versions`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(
        typeof data.error === "string" ? data.error : "Failed to load versions",
      );
      setVersions([]);
      setLoading(false);
      return;
    }

    setVersions((data.versions as DocumentVersionSummary[]) ?? []);
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    setLoading(Boolean(documentId));
    void refresh();
  }, [documentId, refresh]);

  const restoreVersion = useCallback(
    async (versionId: string) => {
      if (!documentId) return null;

      const response = await fetch(
        `/app/api/documents/${documentId}/versions/${versionId}`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return null;
      }
      await refresh();
      return data.document ?? null;
    },
    [documentId, refresh],
  );

  return { versions, loading, error, refresh, restoreVersion };
}
