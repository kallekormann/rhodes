"use client";

import { useCallback, useEffect, useState } from "react";
import { isDocumentId } from "@/lib/documents/ids";

export type DocumentRecord = {
  id: string;
  workspace_id: string;
  created_by?: string | null;
  title: string;
  content: Record<string, unknown> | null;
  content_plain: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
};

export function useDocument(documentId: string | null) {
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(documentId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!documentId || !isDocumentId(documentId)) {
      setDocument(null);
      setLoading(false);
      setError(documentId ? "Invalid document id" : null);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);

    const response = await fetch(`/app/api/documents/${documentId}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof data.error === "string" ? data.error : "Failed to load document";
      if (!options?.silent) {
        setError(message);
        setDocument(null);
      }
      setLoading(false);
      return;
    }

    setDocument(data.document as DocumentRecord);
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: {
      title?: string;
      content?: Record<string, unknown>;
      content_plain?: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!documentId) return null;

      const response = await fetch(`/app/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return null;
      }

      const next = data.document as DocumentRecord;
      setDocument(next);
      return next;
    },
    [documentId],
  );

  return { document, loading, error, refresh, save };
}
