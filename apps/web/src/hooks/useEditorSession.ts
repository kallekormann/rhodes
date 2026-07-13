"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { getScopeMetaLabel } from "@/data/scopes";
import { EMPTY_DOCUMENT_CONTENT } from "@/lib/documents/schemas";
import type { DocumentShareContext } from "@/lib/documents/share-context";
import {
  documentAccessibleInActiveScope,
  emptyShareContext,
} from "@/lib/documents/share-context";
import {
  normalizeDocumentImageContent,
  resolveDocumentImageUrls,
} from "@/lib/documents/editor-commands";
import { withUserMetadataValue, type MetadataFieldValue } from "@/lib/metadata/schemas";
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
import { writeLastDocumentId } from "@/lib/documents/last-document";
import {
  buildTemplateMetadata,
  parseTemplateMetadata,
  type TemplateMetadata,
} from "@/lib/templates/metadata";
import { isTemplateId } from "@/lib/templates/ids";
import { useDocument, type DocumentRecord } from "@/hooks/useDocument";
import { useDocumentRealtime, useDocumentAwayNotice } from "@/hooks/useDocumentRealtime";
import { useDocumentPresence } from "@/hooks/useDocumentPresence";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    scopesLoading,
    workspaceId,
    scopes,
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
  const { document, loading, error, save, refresh } = useDocument(
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
  const [contentPlain, setContentPlain] = useState("");
  const [contentHydratedForId, setContentHydratedForId] = useState<string | null>(
    null,
  );
  const hydratedDocumentIdRef = useRef<string | null>(null);
  const latestContentRef = useRef<Record<string, unknown>>(EMPTY_DOCUMENT_CONTENT);
  const [publishingTemplate, setPublishingTemplate] = useState(false);
  const [comments, setComments] = useState<StoredDocumentComment[]>([]);
  const [shareContext, setShareContext] = useState<DocumentShareContext>(emptyShareContext());
  const [shareContextVersion, setShareContextVersion] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [contentSyncToken, setContentSyncToken] = useState(0);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [crossScopeAccess, setCrossScopeAccess] = useState<
    "allowed" | "pending" | "denied"
  >("allowed");

  const refreshShareContext = useCallback(() => {
    setShareContextVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!document?.id || isEditingTemplate || !resolvedWorkspaceId) {
      setShareContext(emptyShareContext());
      return;
    }

    let cancelled = false;

    const documentId = document.id;
    const documentWorkspaceId = document.workspace_id;

    async function loadShareContext() {
      const params = new URLSearchParams();
      if (resolvedWorkspaceId) {
        params.set("active_workspace_id", resolvedWorkspaceId);
      }

      const response = await fetch(
        `/app/api/documents/${documentId}/shares?${params.toString()}`,
      );
      const body = (await response.json().catch(() => ({}))) as {
        shares?: Array<{ label: string; grantee_type: string }>;
        shared_by_user?: string | null;
      };

      if (cancelled) return;

      const shares = body.shares ?? [];
      const isOrigin = documentWorkspaceId === resolvedWorkspaceId;

      if (isOrigin) {
        const sharedWith = shares.map((share) => share.label).filter(Boolean);
        setShareContext({
          is_origin: true,
          is_incoming: false,
          has_outgoing: sharedWith.length > 0,
          shared_with: sharedWith,
          shared_by_user: null,
        });
        return;
      }

      setShareContext({
        is_origin: false,
        is_incoming: true,
        has_outgoing: false,
        shared_with: [],
        shared_by_user: body.shared_by_user ?? null,
      });
    }

    void loadShareContext();

    return () => {
      cancelled = true;
    };
  }, [document?.id, document?.workspace_id, isEditingTemplate, resolvedWorkspaceId, scopes, shareContextVersion]);

  useEffect(() => {
    if (isEditingTemplate || !document?.id) return;
    if (hydratedDocumentIdRef.current === document.id) return;

    hydratedDocumentIdRef.current = document.id;

    const raw =
      (document.content as Record<string, unknown> | null) ??
      EMPTY_DOCUMENT_CONTENT;

    let cancelled = false;

    const docId = document.id;
    const docMetadata = document.metadata;
    const docContentPlain = document.content_plain;

    async function hydrateDocumentContent() {
      const normalized = normalizeDocumentImageContent(raw);
      let resolved = normalized;
      try {
        resolved = await resolveDocumentImageUrls(normalized);
      } catch {
        resolved = normalized;
      }
      if (cancelled) return;

      setEditorContent(resolved);
      latestContentRef.current = resolved;
      setContentPlain(docContentPlain?.trim() ?? "");
      setContentHydratedForId(docId);
      setComments(parseDocumentComments(docMetadata));
    }

    void hydrateDocumentContent();

    return () => {
      cancelled = true;
    };
  }, [document?.id, document?.content, document?.metadata, isEditingTemplate]);

  useEffect(() => {
    if (isEditingTemplate || !document?.id) return;

    // Realtime + 15s fallback polling handled by useDocumentRealtime.
  }, [document?.id, isEditingTemplate]);

  const applyRemoteDocument = useCallback(async (remote: DocumentRecord) => {
    const raw =
      (remote.content as Record<string, unknown> | null) ?? EMPTY_DOCUMENT_CONTENT;
    const normalized = normalizeDocumentImageContent(raw);
    let resolved = normalized;
    try {
      resolved = await resolveDocumentImageUrls(normalized);
    } catch {
      resolved = normalized;
    }

    setEditorContent(resolved);
    latestContentRef.current = resolved;
    setContentPlain(remote.content_plain?.trim() ?? "");
    setContentHydratedForId(remote.id);
    setComments(parseDocumentComments(remote.metadata));
    setDocumentTitle(remote.title);
    setDocumentId(remote.id);
    setIsDirty(false);
    hydratedDocumentIdRef.current = remote.id;
    setContentSyncToken((token) => token + 1);
    void refresh({ silent: true });
  }, [refresh, setDocumentId, setDocumentTitle]);

  const {
    live: documentLive,
    conflict: remoteConflict,
    dismissConflict,
    reloadRemote,
    markSynced,
    setBaselineUpdatedAt,
  } = useDocumentRealtime({
    documentId: isEditingTemplate ? null : (document?.id ?? null),
    currentUserId: session.userId,
    enabled: !isEditingTemplate && crossScopeAccess === "allowed",
    isDirty,
    onRemoteUpdate: applyRemoteDocument,
  });

  const { awayNotice, dismissAwayNotice } = useDocumentAwayNotice(
    isEditingTemplate ? null : (document?.id ?? null),
    document?.updated_at ?? null,
    session.userId,
  );

  useEffect(() => {
    if (document?.updated_at) {
      setBaselineUpdatedAt(document.updated_at);
    }
  }, [document?.id, document?.updated_at, setBaselineUpdatedAt]);

  const { lockedBlockId, lockedByName } = useDocumentPresence({
    documentId: isEditingTemplate ? null : (document?.id ?? null),
    userId: session.userId,
    displayName: session.displayName || session.userEmail,
    avatarUrl: session.avatarUrl,
    isTyping,
    activeBlockId,
    enabled: !isEditingTemplate && crossScopeAccess === "allowed",
  });

  useEffect(() => {
    if (!isEditingTemplate && document?.id) {
      setIsDirty(false);
    }
  }, [document?.id, isEditingTemplate]);

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

        let resolved = raw;
        try {
          resolved = await resolveDocumentImageUrls(raw);
        } catch {
          resolved = raw;
        }

        if (cancelled) return;

        setEditorContent(resolved);
        latestContentRef.current = resolved;
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

    if (requestedId && isDocumentId(requestedId)) {
      setResolvedId(requestedId);
      return;
    }

    router.replace("/documents");
  }, [scopesLoading, requestedId, isEditingTemplate, router]);

  useEffect(() => {
    if (!document || !resolvedWorkspaceId || isEditingTemplate) {
      setCrossScopeAccess("allowed");
      return;
    }

    if (document.workspace_id === resolvedWorkspaceId) {
      setCrossScopeAccess("allowed");
      return;
    }

    let cancelled = false;
    setCrossScopeAccess("pending");

    const activeScope = scopes.find((scope) => scope.id === resolvedWorkspaceId);
    const isPersonalScope = activeScope?.type === "private";

    void documentAccessibleInActiveScope(
      document.id,
      document.workspace_id,
      resolvedWorkspaceId,
      {
        userId: session.userId,
        personalScope: isPersonalScope,
      },
    ).then((allowed) => {
      if (!cancelled) {
        setCrossScopeAccess(allowed ? "allowed" : "denied");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    document?.id,
    document?.workspace_id,
    isEditingTemplate,
    resolvedWorkspaceId,
    scopes,
    session.userId,
  ]);

  useEffect(() => {
    if (crossScopeAccess === "denied") {
      router.replace("/documents");
    }
  }, [crossScopeAccess, router]);

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

  const persistDocument = useCallback(
    async (patch: Parameters<typeof save>[0]) => {
      const result = await save(patch);
      if (!result) {
        showToast("Couldn't save document", "error");
        return null;
      }
      markSynced(result.updated_at);
      setIsDirty(false);
      return result;
    },
    [markSynced, save, showToast],
  );

  const debouncedSaveContent = useDebouncedCallback(
    (content: Record<string, unknown>, content_plain: string) => {
      void persistDocument({
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
      setContentPlain(content_plain);
      if (!isEditingTemplate) {
        setIsDirty(true);
        setIsTyping(true);
        if (typingIdleTimerRef.current) {
          clearTimeout(typingIdleTimerRef.current);
        }
        typingIdleTimerRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 2_000);
      }
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

  const metadataWorkspaceId = isEditingTemplate
    ? templateRecord?.workspace_id ?? resolvedWorkspaceId
    : document?.workspace_id ?? resolvedWorkspaceId;

  const {
    schemas: metadataSchemas,
    groups: metadataGroups,
    loading: metadataSchemasLoading,
    createSchema,
    createGroup,
    updateSchema,
    updateGroup,
    deleteSchema,
    deleteGroup,
  } = useMetadataSchemas(metadataWorkspaceId);

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
    void persistDocument({ title });
  }, 400);

  const debouncedSaveTemplateTitle = useDebouncedCallback((title: string) => {
    if (!templateRecord) return;
    void updateTemplate({ id: templateRecord.id, name: title });
  }, 400);

  const debouncedSaveTemplateDescription = useDebouncedCallback(
    (description: string) => {
      if (!templateRecord) return;
      void updateTemplate({ id: templateRecord.id, description });
      setTemplateRecord((prev) =>
        prev ? { ...prev, description } : prev,
      );
    },
    400,
  );

  const debouncedSaveTemplateMetadata = useDebouncedCallback(
    (metadata: TemplateMetadata) => {
      if (!templateRecord) return;
      const payload = buildTemplateMetadata(metadata);
      void updateTemplate({ id: templateRecord.id, metadata: payload });
      setTemplateRecord((prev) =>
        prev ? { ...prev, metadata: payload } : prev,
      );
    },
    400,
  );

  const saveMetadataField = useCallback(
    (fieldKey: string, value: MetadataFieldValue) => {
      if (!document) return;
      void persistDocument({
        metadata: withUserMetadataValue(document.metadata, fieldKey, value),
      });
    },
    [document, persistDocument],
  );

  const saveMetadataDocument = useCallback(
    (metadata: Record<string, unknown>) => {
      if (!document) return;
      void persistDocument({ metadata });
    },
    [document, persistDocument],
  );

  const debouncedSaveComments = useDebouncedCallback(
    (nextComments: StoredDocumentComment[]) => {
      if (!document) return;
      void persistDocument({
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
    void persistDocument({ metadata });
  }, [document, persistDocument]);

  const loadErrorToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error || isEditingTemplate) return;
    if (loadErrorToastRef.current === error) return;
    loadErrorToastRef.current = error;
    showToast(error, "error");
  }, [error, isEditingTemplate, showToast]);

  const content = editorContent;
  const templateHydrationKey = templateRecord
    ? `template:${templateRecord.id}`
    : null;

  const templateMetadata = templateRecord
    ? parseTemplateMetadata(templateRecord.metadata)
    : undefined;

  const createdByLabel =
    document?.created_by && session.userId
      ? document.created_by === session.userId
        ? session.displayName || "You"
        : "Workspace member"
      : null;

  const documentScope = document?.workspace_id
    ? scopes.find((scope) => scope.id === document.workspace_id)
    : null;
  const documentScopeLabel = documentScope ? getScopeMetaLabel(documentScope) : null;

  return {
    document: document as DocumentRecord | null,
    documentId: isEditingTemplate ? null : (document?.id ?? null),
    documentScopeLabel,
    shareContext,
    refreshShareContext,
    workspaceId: isEditingTemplate
      ? (templateRecord?.workspace_id ?? resolvedWorkspaceId)
      : (document?.workspace_id ?? null),
    loading: isEditingTemplate
      ? templateLoading ||
        !templateRecord ||
        contentHydratedForId !== templateHydrationKey
      : scopesLoading ||
        !resolvedId ||
        !resolvedWorkspaceId ||
        crossScopeAccess === "pending" ||
        (!document && loading) ||
        (document != null && contentHydratedForId !== document.id),
    error: isEditingTemplate ? templateError : error,
    content,
    contentPlain,
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
    documentMetadata: document?.metadata ?? null,
    metadataSchemas,
    metadataGroups,
    metadataSchemasLoading,
    createMetadataSchema: createSchema,
    createMetadataGroup: createGroup,
    updateMetadataSchema: updateSchema,
    updateMetadataGroup: updateGroup,
    deleteMetadataSchema: deleteSchema,
    deleteMetadataGroup: deleteGroup,
    createdByLabel,
    templateDescription: templateRecord?.description ?? "",
    templateMetadata,
    onMetadataFieldChange: saveMetadataField,
    onMetadataGroupInstancesChange: saveMetadataDocument,
    onTemplateDescriptionChange: debouncedSaveTemplateDescription,
    onTemplateMetadataChange: debouncedSaveTemplateMetadata,
    onTitleChange: (title: string) => {
      setDocumentTitle(title);
      if (!isEditingTemplate) {
        setIsDirty(true);
      }
      if (isEditingTemplate) {
        debouncedSaveTemplateTitle(title);
      } else {
        debouncedSaveTitle(title);
      }
    },
    documentLive,
    remoteConflict,
    awayNotice,
    dismissRemoteConflict: dismissConflict,
    dismissAwayNotice,
    reloadRemoteDocument: reloadRemote,
    contentSyncToken,
    activeBlockId,
    onActiveBlockChange: setActiveBlockId,
    lockedBlockId,
    lockedByName,
  };
}
