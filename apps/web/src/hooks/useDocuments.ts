"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentFilter } from "@/lib/documents/schemas";
import type { DocumentRecord } from "@/hooks/useDocument";

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
    [workspaceId],
  );

  const updateDocument = useCallback(
    async (
      id: string,
      patch: { title?: string; metadata?: Record<string, unknown> },
    ) => {
      try {
        const updated = await patchDocumentById(id, patch);
        setDocuments((prev) => prev.map((doc) => (doc.id === id ? updated : doc)));
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
        return null;
      }
    },
    [],
  );

  const deleteDocument = useCallback(async (id: string) => {
    const response = await fetch(`/app/api/documents/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Delete failed");
      return false;
    }
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    return true;
  }, []);

  return {
    documents,
    loading,
    error,
    refresh,
    createDocument,
    updateDocument,
    deleteDocument,
  };
}
