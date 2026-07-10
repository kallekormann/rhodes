"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentFilter } from "@/lib/documents/schemas";
import type { DocumentRecord } from "@/hooks/useDocument";

export function useDocuments(workspaceId: string | null, filter: DocumentFilter = "recent") {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

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
  }, [workspaceId, filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createDocument = useCallback(
    async (input?: { title?: string; template_id?: string }) => {
      if (!workspaceId) return null;

      const response = await fetch("/app/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          title: input?.title,
          template_id: input?.template_id,
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
    [workspaceId],
  );

  return { documents, loading, error, refresh, createDocument };
}
