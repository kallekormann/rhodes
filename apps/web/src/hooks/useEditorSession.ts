"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { EMPTY_DOCUMENT_CONTENT } from "@/lib/documents/schemas";
import {
  readLastDocumentId,
  writeLastDocumentId,
} from "@/lib/documents/last-document";
import { useDocument, type DocumentRecord } from "@/hooks/useDocument";
import { useDocuments } from "@/hooks/useDocuments";

function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    (...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );
}

export function useEditorSession() {
  const searchParams = useSearchParams();
  const { activeScope, scopesLoading, setDocumentTitle, setDocumentId } = useApp();
  const workspaceId =
    scopesLoading || activeScope.id === "loading" ? null : activeScope.id;

  const requestedId = searchParams.get("doc");
  const [resolvedId, setResolvedId] = useState<string | null>(requestedId);
  const { createDocument } = useDocuments(workspaceId, "recent");
  const { document, loading, error, save } = useDocument(resolvedId);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function resolveDocument() {
      const wsId = workspaceId;
      if (!wsId) return;

      if (requestedId) {
        setResolvedId(requestedId);
        writeLastDocumentId(wsId, requestedId);
        return;
      }

      const lastId = readLastDocumentId(wsId);
      if (lastId) {
        setResolvedId(lastId);
        return;
      }

      const created = await createDocument();
      if (cancelled || !created) return;
      setResolvedId(created.id);
      writeLastDocumentId(wsId, created.id);
    }

    void resolveDocument();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, requestedId, createDocument]);

  useEffect(() => {
    if (!document) return;
    setDocumentId(document.id);
    setDocumentTitle(document.title);
    writeLastDocumentId(document.workspace_id, document.id);
  }, [document, setDocumentId, setDocumentTitle]);

  const debouncedSaveContent = useDebouncedCallback(
    (content: Record<string, unknown>, content_plain: string) => {
      void save({ content, content_plain });
    },
    500,
  );

  const debouncedSaveTitle = useDebouncedCallback((title: string) => {
    void save({ title });
  }, 400);

  const content =
    (document?.content as Record<string, unknown> | null) ?? EMPTY_DOCUMENT_CONTENT;

  return {
    document: document as DocumentRecord | null,
    loading: scopesLoading || loading || !resolvedId || !workspaceId,
    error,
    content,
    onContentUpdate: debouncedSaveContent,
    onTitleChange: (title: string) => {
      setDocumentTitle(title);
      debouncedSaveTitle(title);
    },
  };
}
