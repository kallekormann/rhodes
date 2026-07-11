"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { EMPTY_DOCUMENT_CONTENT } from "@/lib/documents/schemas";
import {
  normalizeDocumentImageContent,
} from "@/lib/documents/editor-commands";
import {
  createDocumentComment,
  getCommentIdsToRemove,
  parseDocumentComments,
  syncCommentsWithDocument,
  withDocumentComments,
  type StoredDocumentComment,
} from "@/lib/documents/comments";
import { formatCreatedAt, formatUpdatedAt } from "@/lib/documents/format";
import { isDocumentId } from "@/lib/documents/ids";
import {
  readLastDocumentId,
  writeLastDocumentId,
} from "@/lib/documents/last-document";
import { isTemplateId } from "@/lib/templates/ids";
import { useDocument, type DocumentRecord } from "@/hooks/useDocument";
import { useDocuments } from "@/hooks/useDocuments";
import type { Editor } from "@tiptap/react";
import {
  createTemplate,
  fetchTemplate,
  updateTemplate,
  type TemplateDetail,
} from "@/hooks/useTemplates";

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
  const {
    scopesLoading,
    workspaceId,
    ensureWorkspace,
    setDocumentTitle,
    setDocumentId,
    documentTitle,
    setView,
    showToast,
    session,
  } = useApp();
  const resolvedWorkspaceId = workspaceId;

  const requestedId = searchParams.get("doc");
  const requestedTemplateId = searchParams.get("template");
  const isEditingTemplate = isTemplateId(requestedTemplateId);

  const [resolvedId, setResolvedId] = useState<string | null>(
    isEditingTemplate
      ? null
      : isDocumentId(requestedId)
        ? requestedId
        : null,
  );
  const { createDocument } = useDocuments(resolvedWorkspaceId, "recent");
  const { document, loading, error, save } = useDocument(
    isEditingTemplate ? null : resolvedId,
  );
  const [templateRecord, setTemplateRecord] = useState<TemplateDetail | null>(
    null,
  );
  const [templateLoading, setTemplateLoading] = useState(isEditingTemplate);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [editorContent, setEditorContent] = useState<Record<string, unknown>>(
    EMPTY_DOCUMENT_CONTENT,
  );
  const [contentHydratedForId, setContentHydratedForId] = useState<string | null>(
    null,
  );
  const hydratedDocumentIdRef = useRef<string | null>(null);
  const latestContentRef = useRef<Record<string, unknown>>(EMPTY_DOCUMENT_CONTENT);
  const [publishingTemplate, setPublishingTemplate] = useState(false);
  const [comments, setComments] = useState<StoredDocumentComment[]>([]);

  useEffect(() => {
    if (isEditingTemplate || !document?.id) return;
    if (hydratedDocumentIdRef.current === document.id) return;

    hydratedDocumentIdRef.current = document.id;

    const raw =
      (document.content as Record<string, unknown> | null) ??
      EMPTY_DOCUMENT_CONTENT;

    setEditorContent(normalizeDocumentImageContent(raw));
    latestContentRef.current = normalizeDocumentImageContent(raw);
    setContentHydratedForId(document.id);
    setComments(parseDocumentComments(document.metadata));
  }, [document?.id, document?.content, document?.metadata, isEditingTemplate]);

  useEffect(() => {
    if (!isEditingTemplate || !requestedTemplateId) {
      setTemplateRecord(null);
      setTemplateLoading(false);
      setTemplateError(null);
      return;
    }

    const templateId = requestedTemplateId;
    let cancelled = false;
    hydratedDocumentIdRef.current = null;

    async function loadTemplate() {
      setTemplateLoading(true);
      setTemplateError(null);

      try {
        const template = await fetchTemplate(templateId);
        if (cancelled) return;

        setTemplateRecord(template);
        setDocumentTitle(template.name);
        setDocumentId("");

        const raw = normalizeDocumentImageContent(
          (template.structure_json as Record<string, unknown> | null) ??
            EMPTY_DOCUMENT_CONTENT,
        );
        setEditorContent(raw);
        latestContentRef.current = raw;
        setContentHydratedForId(`template:${template.id}`);
      } catch (err) {
        if (cancelled) return;
        setTemplateError(
          err instanceof Error ? err.message : "Failed to load template",
        );
        setTemplateRecord(null);
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    }

    void loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [isEditingTemplate, requestedTemplateId, setDocumentTitle, setDocumentId]);

  useEffect(() => {
    if (scopesLoading || isEditingTemplate) return;

    let cancelled = false;

    async function resolveDocument() {
      let wsId = resolvedWorkspaceId;
      if (!wsId) {
        const scope = await ensureWorkspace();
        if (cancelled || !scope) return;
        wsId = scope.id;
      }

      if (requestedId && isDocumentId(requestedId)) {
        setResolvedId(requestedId);
        writeLastDocumentId(wsId, requestedId);
        return;
      }

      const lastId = readLastDocumentId(wsId);
      if (lastId && isDocumentId(lastId)) {
        setResolvedId(lastId);
        return;
      }

      const created = await createDocument(undefined, wsId);
      if (cancelled || !created) return;
      setResolvedId(created.id);
      writeLastDocumentId(wsId, created.id);
    }

    void resolveDocument();

    return () => {
      cancelled = true;
    };
  }, [
    scopesLoading,
    resolvedWorkspaceId,
    requestedId,
    createDocument,
    ensureWorkspace,
    isEditingTemplate,
  ]);

  useEffect(() => {
    if (!document || isEditingTemplate) return;
    if (document.metadata?.template_draft === true) {
      setDocumentId(document.id);
      setDocumentTitle(document.title);
      return;
    }

    setDocumentId(document.id);
    setDocumentTitle(document.title);
    writeLastDocumentId(document.workspace_id, document.id);
  }, [document, isEditingTemplate, setDocumentId, setDocumentTitle]);

  const debouncedSaveContent = useDebouncedCallback(
    (content: Record<string, unknown>, content_plain: string) => {
      void save({
        content: normalizeDocumentImageContent(content),
        content_plain,
      });
    },
    500,
  );

  const debouncedSaveTemplateContent = useDebouncedCallback(
    (content: Record<string, unknown>) => {
      if (!templateRecord) return;
      void updateTemplate({
        id: templateRecord.id,
        structureJson: normalizeDocumentImageContent(content),
      });
    },
    500,
  );

  const handleContentUpdate = useCallback(
    (content: Record<string, unknown>, content_plain: string) => {
      latestContentRef.current = content;
      setEditorContent(content);
      if (isEditingTemplate && templateRecord) {
        debouncedSaveTemplateContent(content);
      } else {
        debouncedSaveContent(content, content_plain);
      }
    },
    [
      debouncedSaveContent,
      debouncedSaveTemplateContent,
      isEditingTemplate,
      templateRecord,
    ],
  );

  const isTemplateDraft = document?.metadata?.template_draft === true;
  const isTemplateMode = isTemplateDraft || isEditingTemplate;

  const saveAsTemplate = useCallback(async () => {
    if (publishingTemplate) return false;

    setPublishingTemplate(true);
    try {
      if (isEditingTemplate && templateRecord) {
        await updateTemplate({
          id: templateRecord.id,
          name: documentTitle.trim() || "Untitled Template",
          structureJson: normalizeDocumentImageContent(latestContentRef.current),
        });
        setView("templates");
        showToast("Template saved", "success");
        return true;
      }

      if (!document || !workspaceId) return false;

      await createTemplate({
        workspaceId,
        name:
          documentTitle.trim() ||
          document.title.trim() ||
          "Untitled Template",
        description:
          typeof document.metadata?.template_description === "string"
            ? document.metadata.template_description
            : undefined,
        structureJson: normalizeDocumentImageContent(latestContentRef.current),
        sourceDocumentId: isTemplateDraft ? document.id : undefined,
      });

      if (isTemplateDraft) {
        setView("templates");
        showToast("Template published", "success");
      } else {
        showToast("Saved as template", "success");
      }
      return true;
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't save template",
        "error",
      );
      return false;
    } finally {
      setPublishingTemplate(false);
    }
  }, [
    document,
    workspaceId,
    publishingTemplate,
    isTemplateDraft,
    isEditingTemplate,
    templateRecord,
    documentTitle,
    setView,
    showToast,
  ]);

  const debouncedSaveTitle = useDebouncedCallback((title: string) => {
    void save({ title });
  }, 400);

  const debouncedSaveTemplateTitle = useDebouncedCallback((title: string) => {
    if (!templateRecord) return;
    void updateTemplate({ id: templateRecord.id, name: title });
  }, 400);

  const debouncedSaveComments = useDebouncedCallback(
    (nextComments: StoredDocumentComment[]) => {
      if (!document) return;
      void save({
        metadata: withDocumentComments(document.metadata, nextComments),
      });
    },
    400,
  );

  const addComment = useCallback(
    (input: {
      blockId: string;
      blockIndex: number;
      from: number;
      to: number;
      anchorText: string;
      text: string;
    }) => {
      if (!document) return null;

      const comment = createDocumentComment({
        ...input,
        author: session.displayName || "You",
      });
      const nextComments = [...comments, comment];
      setComments(nextComments);
      debouncedSaveComments(nextComments);
      return comment;
    },
    [comments, debouncedSaveComments, document, session.displayName],
  );

  const addReply = useCallback(
    (parentId: string, text: string) => {
      if (!document) return null;

      const parent = comments.find((comment) => comment.id === parentId);
      if (!parent) return null;

      const reply = createDocumentComment({
        parentId,
        blockId: parent.blockId,
        blockIndex: parent.blockIndex,
        from: parent.from,
        to: parent.to,
        anchorText: parent.anchorText,
        text: text.trim(),
        author: session.displayName || "You",
      });
      const nextComments = [...comments, reply];
      setComments(nextComments);
      debouncedSaveComments(nextComments);
      return reply;
    },
    [comments, debouncedSaveComments, document, session.displayName],
  );

  const removeComment = useCallback(
    (commentId: string) => {
      if (!document) return;

      const idsToRemove = getCommentIdsToRemove(comments, commentId);
      if (idsToRemove.size === 0) return;

      const nextComments = comments.filter(
        (comment) => !idsToRemove.has(comment.id),
      );
      setComments(nextComments);
      debouncedSaveComments(nextComments);
    },
    [comments, debouncedSaveComments, document],
  );

  const syncCommentsFromEditor = useCallback(
    (editor: Editor) => {
      setComments((prev) => {
        const next = syncCommentsWithDocument(editor, prev);
        if (next === prev) return prev;
        debouncedSaveComments(next);
        return next;
      });
    },
    [debouncedSaveComments],
  );

  const toggleFavorite = useCallback(() => {
    if (!document) return;
    const metadata = { ...(document.metadata ?? {}) };
    const nextFavorite = metadata.favorite !== true;
    metadata.favorite = nextFavorite;
    void save({ metadata });
  }, [document, save]);

  const content = editorContent;
  const templateHydrationKey = templateRecord
    ? `template:${templateRecord.id}`
    : null;

  return {
    document: document as DocumentRecord | null,
    documentId: isEditingTemplate ? null : (document?.id ?? null),
    workspaceId: isEditingTemplate
      ? (templateRecord?.workspace_id ?? resolvedWorkspaceId)
      : (document?.workspace_id ?? null),
    loading: isEditingTemplate
      ? templateLoading ||
        !templateRecord ||
        contentHydratedForId !== templateHydrationKey
      : scopesLoading ||
        loading ||
        !resolvedId ||
        !resolvedWorkspaceId ||
        (document != null && contentHydratedForId !== document.id),
    error: isEditingTemplate ? templateError : error,
    content,
    createdAtLabel: isEditingTemplate
      ? null
      : document
        ? formatCreatedAt(document.created_at)
        : null,
    updatedAtLabel: isEditingTemplate
      ? templateRecord
        ? formatUpdatedAt(templateRecord.created_at)
        : null
      : document
        ? formatUpdatedAt(document.updated_at)
        : null,
    isFavorite: document?.metadata?.favorite === true,
    isTemplateDraft,
    isEditingTemplate,
    isTemplateMode,
    publishingTemplate,
    saveAsTemplate,
    toggleFavorite,
    comments,
    addComment,
    addReply,
    removeComment,
    syncCommentsFromEditor,
    onContentUpdate: handleContentUpdate,
    onTitleChange: (title: string) => {
      setDocumentTitle(title);
      if (isEditingTemplate) {
        debouncedSaveTemplateTitle(title);
      } else {
        debouncedSaveTitle(title);
      }
    },
  };
}
