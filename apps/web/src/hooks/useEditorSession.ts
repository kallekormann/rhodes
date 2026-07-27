"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { pushOutbox } from "@/lib/offline/sync-engine";
import {
  buildTemplateMetadata,
  parseTemplateMetadata,
  type TemplateMetadata,
} from "@/lib/templates/metadata";
import { isTemplateId } from "@/lib/templates/ids";
import { useDocument, type DocumentRecord } from "@/hooks/useDocument";
import { useDocumentRealtime, useDocumentAwayNotice } from "@/hooks/useDocumentRealtime";
import { useDocumentPresence } from "@/hooks/useDocumentPresence";
import { useYjsCollaboration } from "@/hooks/useYjsCollaboration";
import { useOfflineYjsConflict } from "@/hooks/useOfflineYjsConflict";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { Editor } from "@tiptap/react";
import { useMetadataSchemas } from "@/hooks/useMetadataSchemas";
import {
  createTemplate,
  fetchTemplate,
  updateTemplate,
  type TemplateDetail,
} from "@/hooks/useTemplates";

type DebouncedCallback<T extends (...args: never[]) => void> = ((
  ...args: Parameters<T>
) => void) & {
  flush: () => void;
  cancel: () => void;
};

function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number,
): DebouncedCallback<T> {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgs = useRef<Parameters<T> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!lastArgs.current) return;
    const args = lastArgs.current;
    lastArgs.current = null;
    callbackRef.current(...args);
  }, []);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    lastArgs.current = null;
  }, []);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      lastArgs.current = args;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        lastArgs.current = null;
        callbackRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  ) as DebouncedCallback<T>;

  debounced.flush = flush;
  debounced.cancel = cancel;
  return debounced;
}

/**
 * Best-effort projection of the current body into Postgres (documents.content /
 * content_plain) for search, RAG and the activity feed. The Yjs CRDT (via
 * document_yjs_state) is the durable source of truth for the body — this
 * write is force-applied (no OCC) and simply skipped while offline, since
 * RhodesYjsPersistence retains offline body edits in rhodes-db; the next online edit (or
 * reconnect flush) will catch the projection back up.
 */
async function persistContentProjection(
  documentId: string,
  content: Record<string, unknown>,
  contentPlain: string,
): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    await fetch(`/app/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: normalizeDocumentImageContent(content),
        content_plain: contentPlain,
        force: true,
      }),
    });
  } catch {
    /* best-effort — next edit or reconnect retries */
  }
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
    canWriteActiveScope,
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
  const { online } = useOnlineStatus(
    isEditingTemplate ? null : (resolvedWorkspaceId ?? null),
  );
  const { document, loading, error, save, refresh, applyLocal } = useDocument(
    isEditingTemplate ? null : resolvedId,
    online,
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
  const titleHydratedForIdRef = useRef<string | null>(null);
  const latestContentRef = useRef<Record<string, unknown>>(EMPTY_DOCUMENT_CONTENT);
  const debouncedSaveContentRef = useRef<DebouncedCallback<
    (content: Record<string, unknown>, content_plain: string) => void
  > | null>(null);
  const debouncedSaveTitleRef = useRef<DebouncedCallback<
    (title: string) => void
  > | null>(null);
  const debouncedSaveCommentsRef = useRef<DebouncedCallback<
    (nextComments: StoredDocumentComment[]) => void
  > | null>(null);
  const contentPlainRef = useRef("");
  const [publishingTemplate, setPublishingTemplate] = useState(false);
  const [comments, setComments] = useState<StoredDocumentComment[]>([]);
  const [shareContext, setShareContext] = useState<DocumentShareContext>(emptyShareContext());
  const [canEditDocument, setCanEditDocument] = useState(true);
  const [shareContextVersion, setShareContextVersion] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [cursorSelection, setCursorSelection] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const cursorSelectionRef = useRef<{ from: number; to: number } | null>(null);
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
      setCanEditDocument(true);
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
        can_write?: boolean;
      };

      if (cancelled) return;

      if (typeof body.can_write === "boolean") {
        setCanEditDocument(body.can_write);
      } else {
        setCanEditDocument(canWriteActiveScope);
      }

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
  }, [canWriteActiveScope, document?.id, document?.workspace_id, isEditingTemplate, resolvedWorkspaceId, scopes, shareContextVersion]);

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
      setContentSyncToken((token) => token + 1);
      setComments(parseDocumentComments(docMetadata));
    }

    void hydrateDocumentContent();

    return () => {
      cancelled = true;
    };
  }, [document?.id, document?.content, document?.metadata, isEditingTemplate]);

  const collabActiveRef = useRef(false);
  const editorForConflictRef = useRef<Editor | null>(null);
  const ydocForSnapshotRef = useRef<import("yjs").Doc | null>(null);

  const {
    ydoc,
    provider: collabProvider,
    synced: collabSynced,
    catchupComplete: collabCatchupComplete,
    docReady: collabDocReady,
    collabActive,
    collaborationUser,
    needsInitialSeed: collabNeedsInitialSeed,
    flushPersist: flushCollabPersist,
  } = useYjsCollaboration({
    documentId: isEditingTemplate ? null : (document?.id ?? null),
    enabled: !isEditingTemplate && crossScopeAccess === "allowed",
    userId: session.userId,
    displayName: session.displayName || session.userEmail,
  });
  ydocForSnapshotRef.current = ydoc;
  collabActiveRef.current = collabActive;

  const collabCursorMode = Boolean(collabProvider && collaborationUser);

  const handleCollabBootstrapped = useCallback(() => {
    flushCollabPersist();
  }, [flushCollabPersist]);

  const {
    offlineConflictBlocks,
    offlineConflictClusters,
    offlineConflictReviews,
    offlineConflictReviewPending,
    keepOfflineMine,
    takeOfflineTheirs,
    keepAllOfflineMine,
    takeAllOfflineTheirs,
    resolveOfflineCluster,
  } = useOfflineYjsConflict({
    documentId: isEditingTemplate ? null : (document?.id ?? null),
    ydoc,
    synced: collabSynced,
    catchupComplete: collabCatchupComplete,
    online,
    remoteUpdateOrigin: collabProvider,
    provider: collabProvider,
    getEditor: () => editorForConflictRef.current,
    flushPersist: flushCollabPersist,
  });

  const registerEditorForConflict = useCallback((editor: Editor | null) => {
    editorForConflictRef.current = editor;
  }, []);

  const applyRemoteDocument = useCallback(
    async (remote: DocumentRecord) => {
      setDocumentTitle(remote.title);
      setDocumentId(remote.id);
      setComments(parseDocumentComments(remote.metadata));

      // Yjs owns the body once live — never let a stale Postgres projection
      // (which can lag behind the CRDT) clobber the live editor content.
      if (collabActiveRef.current) return;

      const raw =
        (remote.content as Record<string, unknown> | null) ??
        EMPTY_DOCUMENT_CONTENT;
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
      hydratedDocumentIdRef.current = remote.id;
      setContentSyncToken((token) => token + 1);
    },
    [setDocumentId, setDocumentTitle],
  );

  useEffect(() => {
    if (!document?.id || !collabActive) return;
    try {
      sessionStorage.setItem(`rhodes:collab-session:${document.id}`, "1");
    } catch {
      /* private mode */
    }
  }, [collabActive, document?.id]);

  const {
    live: documentLive,
    markSynced,
    setBaselineUpdatedAt,
  } = useDocumentRealtime({
    documentId: isEditingTemplate ? null : (document?.id ?? null),
    enabled: !isEditingTemplate && crossScopeAccess === "allowed",
    isDirty,
    onRemoteUpdate: applyRemoteDocument,
  });

  const { awayNotice, dismissAwayNotice } = useDocumentAwayNotice(
    isEditingTemplate ? null : (document?.id ?? null),
    session.userId,
  );

  useEffect(() => {
    if (document?.updated_at) {
      setBaselineUpdatedAt(document.updated_at);
    }
  }, [document?.id, document?.updated_at, setBaselineUpdatedAt]);

  const handleActiveBlockChange = useCallback(
    (blockId: string | null, blockIndex: number | null) => {
      setActiveBlockId(blockId);
      setActiveBlockIndex(blockIndex);
    },
    [],
  );

  const { lockedBlockId, lockedBlockIndex, lockedSelectionFrom, lockedByName, remoteCursors } = useDocumentPresence({
    documentId: isEditingTemplate ? null : (document?.id ?? null),
    userId: session.userId,
    displayName: session.displayName || session.userEmail,
    avatarUrl: session.avatarUrl,
    isTyping,
    activeBlockId,
    activeBlockIndex,
    selectionFrom: cursorSelection?.from ?? null,
    selectionTo: cursorSelection?.to ?? null,
    selectionRef: cursorSelectionRef,
    // Legacy presence overlay until Yjs CollaborationCursor is live.
    enabled:
      !isEditingTemplate &&
      crossScopeAccess === "allowed" &&
      online &&
      !collabCursorMode,
  });

  const onEditorSelectionChange = useCallback((from: number, to: number) => {
    cursorSelectionRef.current = { from, to };
    setCursorSelection({ from, to });
  }, []);

  const onEditorSelectionClear = useCallback(() => {
    cursorSelectionRef.current = null;
    setCursorSelection(null);
    setActiveBlockId(null);
    setActiveBlockIndex(null);
  }, []);

  useEffect(() => {
    if (isEditingTemplate || !document?.id) {
      onEditorSelectionClear();
    }
  }, [document?.id, isEditingTemplate, onEditorSelectionClear]);

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
    if (titleHydratedForIdRef.current === document.id) return;

    titleHydratedForIdRef.current = document.id;
    setDocumentId(document.id);
    setDocumentTitle(document.title);
    if (document.metadata?.template_draft !== true) {
      writeLastDocumentId(document.workspace_id, document.id);
    }
  }, [document?.id, document?.title, isEditingTemplate, setDocumentId, setDocumentTitle]);

  useEffect(() => {
    titleHydratedForIdRef.current = null;
  }, [resolvedId]);

  const persistDocument = useCallback(
    async (patch: Parameters<typeof save>[0]) => {
      const result = await save(patch);
      if (!result) {
        showToast("Couldn't save document", "error");
        return null;
      }
      if (online) {
        markSynced(result.updated_at);
        setIsDirty(false);
      }
      return result;
    },
    [markSynced, online, save, showToast],
  );

  contentPlainRef.current = contentPlain;

  const debouncedSaveContent = useDebouncedCallback(
    (content: Record<string, unknown>, content_plain: string) => {
      if (!document?.id) return;
      void persistContentProjection(document.id, content, content_plain);
    },
    800,
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
    (nextContent: Record<string, unknown>, content_plain: string) => {
      latestContentRef.current = nextContent;
      setEditorContent(nextContent);
      setContentPlain(content_plain);
      if (!isEditingTemplate) {
        setIsDirty(true);
        setIsTyping(true);
        if (typingIdleTimerRef.current) {
          clearTimeout(typingIdleTimerRef.current);
        }
        typingIdleTimerRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 3_500);
      }
      if (isEditingTemplate && templateRecord) {
        debouncedSaveTemplateContent(nextContent);
      } else if (!isEditingTemplate) {
        // Durable persistence is Yjs's job (document_yjs_state); this just
        // keeps the Postgres projection (search/RAG/activity) reasonably fresh.
        debouncedSaveContent(nextContent, content_plain);
      }
    },
    [debouncedSaveContent, debouncedSaveTemplateContent, isEditingTemplate, templateRecord],
  );

  debouncedSaveContentRef.current = debouncedSaveContent;

  // Flush the projection once back online so search/RAG doesn't lag too far
  // behind an offline editing session, even without a further keystroke.
  useEffect(() => {
    if (!online || isEditingTemplate || !document?.id) return;
    const plain = contentPlainRef.current;
    if (plain.trim().length === 0) return;
    void persistContentProjection(document.id, latestContentRef.current, plain);
  }, [online, isEditingTemplate, document?.id]);

  // Flush pending debounced saves before background sync runs on reconnect.
  useLayoutEffect(() => {
    const flushPendingSave = () => {
      debouncedSaveContentRef.current?.flush();
      debouncedSaveTitleRef.current?.flush();
      debouncedSaveCommentsRef.current?.flush();
    };
    const cancelPendingSave = () => {
      debouncedSaveCommentsRef.current?.flush();
      debouncedSaveContentRef.current?.cancel();
      debouncedSaveTitleRef.current?.flush();
    };
    window.addEventListener("online", flushPendingSave, { capture: true });
    window.addEventListener("offline", cancelPendingSave, { capture: true });
    return () => {
      window.removeEventListener("online", flushPendingSave, { capture: true });
      window.removeEventListener("offline", cancelPendingSave, { capture: true });
      debouncedSaveContentRef.current?.flush();
      debouncedSaveTitleRef.current?.flush();
      debouncedSaveCommentsRef.current?.flush();
    };
  }, []);

  // Retry queued title/metadata patches once back online.
  useEffect(() => {
    if (!online) return;
    void pushOutbox();
  }, [online]);

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

  debouncedSaveTitleRef.current = debouncedSaveTitle;

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
      let metadata: Record<string, unknown> | null = null;
      applyLocal((prev) => {
        metadata = withUserMetadataValue(prev.metadata, fieldKey, value);
        return { metadata };
      });
      if (!metadata) return;
      void persistDocument({ metadata }).then((result) => {
        if (!result) void refresh({ silent: true });
      });
    },
    [applyLocal, document, persistDocument, refresh],
  );

  const saveMetadataDocument = useCallback(
    (metadata: Record<string, unknown>) => {
      if (!document) return;
      applyLocal({ metadata });
      void persistDocument({ metadata }).then((result) => {
        if (!result) void refresh({ silent: true });
      });
    },
    [applyLocal, document, persistDocument, refresh],
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
  debouncedSaveCommentsRef.current = debouncedSaveComments;

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
        authorId: session.userId,
        authorAvatarUrl: session.avatarUrl,
      });
      const nextComments = [...comments, comment];
      setComments(nextComments);
      debouncedSaveComments(nextComments);
      return comment;
    },
    [comments, debouncedSaveComments, document, session.avatarUrl, session.displayName, session.userId],
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
        authorId: session.userId,
        authorAvatarUrl: session.avatarUrl,
      });
      const nextComments = [...comments, reply];
      setComments(nextComments);
      debouncedSaveComments(nextComments);
      return reply;
    },
    [comments, debouncedSaveComments, document, session.avatarUrl, session.displayName, session.userId],
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

  const reloadRemoteDocument = useCallback(async () => {
    if (!document?.id) return null;
    const response = await fetch(`/app/api/documents/${document.id}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    const latest = data.document as DocumentRecord;
    await applyRemoteDocument(latest);
    return latest;
  }, [applyRemoteDocument, document?.id]);

  return {
    document: document as DocumentRecord | null,
    documentId: isEditingTemplate ? null : (document?.id ?? null),
    documentScopeLabel,
    shareContext,
    canEditDocument,
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
        (document != null && contentHydratedForId !== document.id) ||
        (!isEditingTemplate &&
          crossScopeAccess === "allowed" &&
          document != null &&
          !collabDocReady),
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
      : collabActive && (isDirty || isTyping)
        ? "Editing live"
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
        applyLocal({ title });
        setIsDirty(true);
      }
      if (isEditingTemplate) {
        debouncedSaveTemplateTitle(title);
      } else {
        debouncedSaveTitle(title);
      }
    },
    documentLive,
    awayNotice,
    dismissAwayNotice,
    reloadRemoteDocument,
    contentSyncToken,
    activeBlockId,
    onActiveBlockChange: handleActiveBlockChange,
    lockedBlockId,
    lockedBlockIndex,
    lockedSelectionFrom,
    lockedByName,
    remoteCursors,
    onEditorSelectionChange,
    ydoc,
    collabProvider,
    collabDocReady,
    collabSynced,
    collabNeedsInitialSeed,
    onCollabBootstrapped: handleCollabBootstrapped,
    collabActive,
    collaborationUser,
    offlineConflictBlocks,
    offlineConflictClusters,
    offlineConflictReviews,
    offlineConflictReviewPending,
    keepOfflineMine,
    takeOfflineTheirs,
    keepAllOfflineMine,
    takeAllOfflineTheirs,
    resolveOfflineCluster,
    registerEditorForConflict,
  };
}
