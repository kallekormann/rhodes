"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import {
  buildEditorPath,
  readDocIdFromBrowserLocation,
  replaceAppHistory,
} from "@/lib/navigation/app-path";
import { pathToView } from "@/lib/navigation";
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
import { prefetchDocumentImages, stripInFlightDocumentImages } from "@/lib/documents/document-image-urls";
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
import { fetchDocumentMetadata } from "@/lib/documents/fetch-document-metadata";
import { isDocumentId } from "@/lib/documents/ids";
import { getOfflineDocument } from "@/lib/offline/documents-cache";
import { bodyRichness } from "@/lib/offline/document-body";
import { writeLastDocumentId, readLastDocumentId } from "@/lib/documents/last-document";
import { readActiveWorkspaceId } from "@/lib/workspaces/scope";
import {
  pushOutbox,
  shouldDeferDocumentPush,
} from "@/lib/offline/sync-engine";
import { flushRhodesYjsPersistence } from "@/lib/offline/yjs-rhodes-persistence";
import { registerEditorSaveFlush } from "@/lib/offline/editor-save-flush";
import {
  buildTemplateMetadata,
  parseTemplateMetadata,
  type TemplateMetadata,
} from "@/lib/templates/metadata";
import { isTemplateId } from "@/lib/templates/ids";
import { useClientHydrated } from "@/hooks/useClientHydrated";
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
import {
  isCollabBootstrapped,
  isEditorShellRevealed,
  markCollabBootstrapped,
  markEditorShellRevealed,
  cacheDocumentTitle,
  readCachedDocumentTitle,
} from "@/lib/editor/editor-shell-session";

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
const COLLAB_PROJECTION_DEBOUNCE_MS = 60_000;

async function persistContentProjection(
  documentId: string,
  content: Record<string, unknown>,
  contentPlain: string,
  onSynced?: (updatedAt: string) => void,
): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (shouldDeferDocumentPush()) return;
  try {
    const response = await fetch(`/app/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: normalizeDocumentImageContent(content),
        content_plain: contentPlain,
        force: true,
      }),
    });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    const updatedAt = (data.document as { updated_at?: string } | undefined)
      ?.updated_at;
    if (typeof updatedAt === "string") {
      onSynced?.(updatedAt);
    }
  } catch {
    /* best-effort — next edit or reconnect retries */
  }
}

export function useEditorSession() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    scopesLoading,
    workspaceId,
    scopes,
    setDocumentTitle,
    setDocumentId,
    documentId: appDocumentId,
    documentTitle,
    setView,
    showToast,
    canWriteActiveScope,
    session,
  } = useApp();
  const hydrated = useClientHydrated();
  const resolvedWorkspaceId = workspaceId ?? readActiveWorkspaceId();
  // Match SSR: assume online until mounted, then sync from navigator.
  const [browserOffline, setBrowserOffline] = useState(false);

  useEffect(() => {
    const syncOffline = () => setBrowserOffline(!navigator.onLine);
    syncOffline();
    window.addEventListener("online", syncOffline);
    window.addEventListener("offline", syncOffline);
    return () => {
      window.removeEventListener("online", syncOffline);
      window.removeEventListener("offline", syncOffline);
    };
  }, []);

  const requestedId = searchParams.get("doc");
  const browserDocId = readDocIdFromBrowserLocation();
  const effectiveRequestedId =
    (requestedId && isDocumentId(requestedId) ? requestedId : null) ??
    (isDocumentId(appDocumentId) ? appDocumentId : null) ??
    (browserDocId && isDocumentId(browserDocId) ? browserDocId : null);
  const requestedTemplateId = searchParams.get("template");
  const isEditingTemplate = isTemplateId(requestedTemplateId);

  const [resolvedId, setResolvedId] = useState<string | null>(
    isEditingTemplate
      ? null
      : effectiveRequestedId,
  );
  const resolvedIdRef = useRef(resolvedId);
  resolvedIdRef.current = resolvedId;
  const previousResolvedIdRef = useRef(resolvedId);
  const { online } = useOnlineStatus(
    isEditingTemplate ? null : (resolvedWorkspaceId ?? null),
  );
  const { document, loading, error, save, refresh, applyLocal } = useDocument(
    isEditingTemplate ? null : resolvedId,
    online,
  );
  const effectiveWorkspaceId =
    resolvedWorkspaceId ?? document?.workspace_id ?? readActiveWorkspaceId();
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
  const debouncedSaveCollabProjectionRef = useRef<DebouncedCallback<
    (content: Record<string, unknown>, content_plain: string) => void
  > | null>(null);
  const collabDocReadyRef = useRef(false);
  const markSyncedRef = useRef<(updatedAt: string) => void>(() => {});
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
    if (!document?.id || isEditingTemplate || !effectiveWorkspaceId) {
      setShareContext(emptyShareContext());
      setCanEditDocument(true);
      return;
    }

    if (browserOffline) {
      setShareContext(emptyShareContext());
      setCanEditDocument(canWriteActiveScope);
      return;
    }

    let cancelled = false;

    const documentId = document.id;
    const documentWorkspaceId = document.workspace_id;

    async function loadShareContext() {
      const params = new URLSearchParams();
      if (effectiveWorkspaceId) {
        params.set("active_workspace_id", effectiveWorkspaceId);
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
      const isOrigin = documentWorkspaceId === effectiveWorkspaceId;

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
  }, [browserOffline, canWriteActiveScope, document?.id, document?.workspace_id, effectiveWorkspaceId, isEditingTemplate, scopes, shareContextVersion]);

  const collabActiveRef = useRef(false);
  const editorForConflictRef = useRef<Editor | null>(null);
  const flushBodyToCacheRef = useRef<() => void>(() => {});
  const ydocForSnapshotRef = useRef<import("yjs").Doc | null>(null);
  const [collabBootstrappedForId, setCollabBootstrappedForId] = useState<
    string | null
  >(null);

  const {
    ydoc,
    provider: collabProvider,
    synced: collabSynced,
    catchupComplete: collabCatchupComplete,
    docReady: collabDocReady,
    collabActive,
    peersPresent: collabPeersPresent,
    collaborationUser,
    needsInitialSeed: collabNeedsInitialSeed,
    flushPersist: flushCollabPersist,
  } = useYjsCollaboration({
    // Start the CRDT as soon as the URL/doc id is known — don't wait for
    // Postgres metadata or we serialize load + risk a collab restart when
    // `document` arrives.
    documentId: isEditingTemplate ? null : resolvedId,
    enabled:
      !isEditingTemplate &&
      Boolean(resolvedId) &&
      crossScopeAccess !== "denied",
    userId: session.userId,
    displayName: session.displayName || session.userEmail,
    getProjectionContent: () => {
      const fromDoc = document?.content as Record<string, unknown> | null;
      if (fromDoc && bodyRichness(fromDoc, document?.content_plain) > 0) {
        return fromDoc;
      }
      const fromEditor = latestContentRef.current;
      if (fromEditor && bodyRichness(fromEditor, null) > 0) return fromEditor;
      return null;
    },
  });
  ydocForSnapshotRef.current = ydoc;
  collabActiveRef.current = collabActive;
  collabDocReadyRef.current = collabDocReady;

  useLayoutEffect(() => {
    if (isEditingTemplate || !document?.id) return;
    if (contentHydratedForId === document.id) return;

    // Hydrate TipTap JSON from Postgres immediately — do not wait for Yjs.
    // Collab TipTap mounts with this snapshot and seeds an empty Y.Doc from it.
    const raw =
      (document.content as Record<string, unknown> | null) ??
      EMPTY_DOCUMENT_CONTENT;
    const normalized = normalizeDocumentImageContent(raw);
    const docId = document.id;

    setEditorContent(normalized);
    latestContentRef.current = normalized;
    setContentPlain(document.content_plain?.trim() ?? "");
    setContentHydratedForId(docId);
    hydratedDocumentIdRef.current = docId;
    setContentSyncToken((token) => token + 1);
    setComments(parseDocumentComments(document.metadata));
    prefetchDocumentImages(normalized);
  }, [
    contentHydratedForId,
    document?.content,
    document?.content_plain,
    document?.id,
    document?.metadata,
    isEditingTemplate,
  ]);

  useEffect(() => {
    if (previousResolvedIdRef.current === resolvedId) return;
    previousResolvedIdRef.current = resolvedId;
    setCollabBootstrappedForId(null);
    hydratedDocumentIdRef.current = null;
    titleHydratedForIdRef.current = null;
    setContentHydratedForId(null);
  }, [resolvedId]);

  useEffect(() => {
    if (
      isEditingTemplate ||
      crossScopeAccess === "denied" ||
      !session.userId ||
      !document?.id ||
      !collabDocReady
    ) {
      return;
    }
    markCollabBootstrapped(document.id);
    setCollabBootstrappedForId(document.id);
  }, [
    collabDocReady,
    crossScopeAccess,
    document?.id,
    isEditingTemplate,
    session.userId,
  ]);

  const collabCursorMode = Boolean(collabProvider && collaborationUser);

  const handleCollabBootstrapped = useCallback(() => {
    flushCollabPersist();
  }, [flushCollabPersist]);

  const handleDocumentImageInserted = useCallback(() => {
    const documentId = document?.id;
    if (!documentId) return;
    window.setTimeout(() => {
      flushCollabPersist();
      void flushRhodesYjsPersistence(documentId);
      debouncedSaveCollabProjectionRef.current?.flush();
    }, 300);
  }, [document?.id, flushCollabPersist]);

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

      // Yjs owns the body once the local CRDT is ready — never let a stale Postgres
      // projection (or our own projection PATCH echo) clobber the live editor.
      if (collabActiveRef.current || collabDocReadyRef.current) return;

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
    enabled:
      !isEditingTemplate &&
      crossScopeAccess === "allowed" &&
      !browserOffline &&
      (!collabDocReady || collabActive),
    isDirty,
    onRemoteUpdate: applyRemoteDocument,
  });
  markSyncedRef.current = markSynced;

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
    // Legacy cursor overlay — not needed while solo on Yjs (session presence handles gating).
    enabled:
      !isEditingTemplate &&
      crossScopeAccess === "allowed" &&
      online &&
      !collabCursorMode &&
      !collabDocReady,
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
    if (isEditingTemplate) return;

    if (scopesLoading && !browserOffline) return;

    const browserDoc =
      readDocIdFromBrowserLocation() ??
      (browserDocId && isDocumentId(browserDocId) ? browserDocId : null);
    const workspaceForLast = resolvedWorkspaceId ?? readActiveWorkspaceId();
    const lastDoc =
      workspaceForLast != null ? readLastDocumentId(workspaceForLast) : null;

    const targetId =
      (effectiveRequestedId && isDocumentId(effectiveRequestedId)
        ? effectiveRequestedId
        : null) ??
      (browserDoc && isDocumentId(browserDoc) ? browserDoc : null) ??
      (lastDoc && isDocumentId(lastDoc) ? lastDoc : null);

    if (targetId) {
      setResolvedId(targetId);
      if (!browserDoc || browserDoc !== targetId) {
        replaceAppHistory(buildEditorPath(targetId));
      }
      return;
    }

    if (!browserOffline && pathToView(pathname) === "editor") {
      router.replace("/documents");
    }
  }, [
    browserDocId,
    browserOffline,
    effectiveRequestedId,
    isEditingTemplate,
    pathname,
    resolvedWorkspaceId,
    router,
    scopesLoading,
  ]);

  useLayoutEffect(() => {
    if (!hydrated || !resolvedId || isEditingTemplate) return;

    const cachedTitle = readCachedDocumentTitle(resolvedId);
    if (cachedTitle) {
      setDocumentTitle(cachedTitle);
    }

    let cancelled = false;
    void getOfflineDocument(resolvedId)
      .then((cached) => {
        if (cancelled || !cached?.title) return;
        if (titleHydratedForIdRef.current === resolvedId) return;
        setDocumentTitle(cached.title);
        cacheDocumentTitle(resolvedId, cached.title);
      })
      .catch(() => {
        /* IDB unavailable */
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, isEditingTemplate, resolvedId, setDocumentTitle]);

  useEffect(() => {
    if (!document || !effectiveWorkspaceId || isEditingTemplate) {
      setCrossScopeAccess("allowed");
      return;
    }

    if (scopesLoading && !browserOffline) {
      return;
    }

    if (document.workspace_id === effectiveWorkspaceId) {
      setCrossScopeAccess("allowed");
      return;
    }

    if (browserOffline || !online) {
      let cancelled = false;
      void getOfflineDocument(document.id)
        .then((cached) => {
          if (!cancelled) {
            setCrossScopeAccess(cached ? "allowed" : "denied");
          }
        })
        .catch(() => {
          if (!cancelled) setCrossScopeAccess("allowed");
        });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    setCrossScopeAccess("pending");

    const activeScope = scopes.find((scope) => scope.id === effectiveWorkspaceId);
    const isPersonalScope = activeScope?.type === "private";

    void documentAccessibleInActiveScope(
      document.id,
      document.workspace_id,
      effectiveWorkspaceId,
      {
        userId: session.userId,
        personalScope: isPersonalScope,
      },
    ).then((allowed) => {
      if (!cancelled) {
        setCrossScopeAccess(allowed ? "allowed" : "denied");
      }
    }).catch(() => {
      if (!cancelled) {
        setCrossScopeAccess("allowed");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    browserOffline,
    document?.id,
    document?.workspace_id,
    effectiveWorkspaceId,
    isEditingTemplate,
    online,
    scopes,
    scopesLoading,
    session.userId,
  ]);

  useEffect(() => {
    if (crossScopeAccess !== "denied") return;
    if (scopesLoading && !browserOffline) return;

    router.replace("/documents");
    replaceAppHistory("/documents");
  }, [browserOffline, crossScopeAccess, router, scopesLoading]);

  useEffect(() => {
    if (!document || isEditingTemplate) return;
    if (titleHydratedForIdRef.current === document.id) return;

    titleHydratedForIdRef.current = document.id;
    setDocumentId(document.id);
    setDocumentTitle(document.title);
    cacheDocumentTitle(document.id, document.title);
    if (document.metadata?.template_draft !== true) {
      writeLastDocumentId(document.workspace_id, document.id);
    }
  }, [document?.id, document?.title, isEditingTemplate, setDocumentId, setDocumentTitle]);

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
  const persistDocumentRef = useRef(persistDocument);
  persistDocumentRef.current = persistDocument;

  contentPlainRef.current = contentPlain;

  const debouncedSaveCollabProjection = useDebouncedCallback(
    (content: Record<string, unknown>, content_plain: string) => {
      const documentId = resolvedIdRef.current;
      if (!documentId) return;
      void persistContentProjection(
        documentId,
        stripInFlightDocumentImages(content),
        content_plain,
        (updatedAt) => markSyncedRef.current(updatedAt),
      );
    },
    COLLAB_PROJECTION_DEBOUNCE_MS,
  );

  const debouncedSaveContent = useDebouncedCallback(
    (content: Record<string, unknown>, content_plain: string) => {
      const documentId = resolvedIdRef.current;
      if (!documentId) return;
      // Always persist through IndexedDB + outbox so local-only creates sync body
      // text reliably. Direct PATCH bypasses the outbox and loses content when the
      // server row does not exist yet.
      void persistDocumentRef.current({
        content: normalizeDocumentImageContent(
          stripInFlightDocumentImages(content),
        ),
        content_plain,
      });
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
          if (collabDocReadyRef.current) {
            debouncedSaveCollabProjectionRef.current?.flush();
          }
        }, 3_500);
      }
      if (isEditingTemplate && templateRecord) {
        debouncedSaveTemplateContent(nextContent);
      } else if (!isEditingTemplate) {
        if (browserOffline) {
          void persistDocumentRef.current({
            content: normalizeDocumentImageContent(
              stripInFlightDocumentImages(nextContent),
            ),
            content_plain,
          });
        } else if (!collabDocReadyRef.current) {
          debouncedSaveContent(nextContent, content_plain);
        }
      }
    },
    [debouncedSaveContent, debouncedSaveTemplateContent, isEditingTemplate, templateRecord],
  );

  debouncedSaveContentRef.current = debouncedSaveContent;
  debouncedSaveCollabProjectionRef.current = debouncedSaveCollabProjection;

  const flushCollabProjection = useCallback(() => {
    const documentId = resolvedIdRef.current;
    if (!documentId || !collabDocReadyRef.current) return;
    const plain = contentPlainRef.current.trim();
    if (plain.length === 0) return;
    void persistContentProjection(
      documentId,
      normalizeDocumentImageContent(latestContentRef.current),
      plain,
      (updatedAt) => markSyncedRef.current(updatedAt),
    );
  }, []);

  const prevOnlineRef = useRef(online);
  useEffect(() => {
    const reconnected = !prevOnlineRef.current && online;
    prevOnlineRef.current = online;
    if (!reconnected || isEditingTemplate || !document?.id) return;
    flushCollabProjection();
  }, [document?.id, flushCollabProjection, isEditingTemplate, online]);

  useEffect(() => {
    const domDocument = window.document;
    const onHide = () => flushCollabProjection();
    window.addEventListener("pagehide", onHide);
    const onVisibility = () => {
      if (domDocument.visibilityState === "hidden") onHide();
    };
    domDocument.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      domDocument.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushCollabProjection]);

  // Flush pending debounced saves before background sync runs on reconnect.
  useLayoutEffect(() => {
    const flushLatestBodyToCache = () => {
      if (collabDocReadyRef.current) return;
      const documentId = resolvedIdRef.current;
      if (!documentId || isEditingTemplate) return;

      const editor = editorForConflictRef.current;
      if (editor && !editor.isDestroyed) {
        const plain = editor.getText().trim();
        if (plain.length === 0) return;
        void persistDocumentRef.current({
          content: normalizeDocumentImageContent(
            editor.getJSON() as Record<string, unknown>,
          ),
          content_plain: editor.getText(),
        });
        return;
      }

      const plain = contentPlainRef.current.trim();
      if (plain.length === 0) return;
      void persistDocumentRef.current({
        content: normalizeDocumentImageContent(latestContentRef.current),
        content_plain: contentPlainRef.current,
      });
    };
    flushBodyToCacheRef.current = flushLatestBodyToCache;
    const flushPendingSave = () => {
      if (!collabDocReadyRef.current) {
        debouncedSaveContentRef.current?.flush();
        flushLatestBodyToCache();
      }
      debouncedSaveCollabProjectionRef.current?.flush();
      debouncedSaveTitleRef.current?.flush();
      debouncedSaveCommentsRef.current?.flush();
    };
    const handleOfflineTransition = () => {
      debouncedSaveCommentsRef.current?.flush();
      if (!collabDocReadyRef.current) {
        debouncedSaveContentRef.current?.flush();
        flushLatestBodyToCache();
      }
      debouncedSaveCollabProjectionRef.current?.flush();
      debouncedSaveTitleRef.current?.flush();
    };
    const unregisterFlush = registerEditorSaveFlush(flushPendingSave);
    window.addEventListener("online", flushPendingSave, { capture: true });
    window.addEventListener("offline", handleOfflineTransition, { capture: true });
    return () => {
      unregisterFlush();
      window.removeEventListener("online", flushPendingSave, { capture: true });
      window.removeEventListener("offline", handleOfflineTransition, {
        capture: true,
      });
      debouncedSaveCommentsRef.current?.flush();
      if (!collabDocReadyRef.current) {
        debouncedSaveContentRef.current?.flush();
        flushLatestBodyToCache();
      }
      debouncedSaveCollabProjectionRef.current?.flush();
      debouncedSaveTitleRef.current?.flush();
    };
  }, [isEditingTemplate]);

  const flushEditorBodySave = useCallback(() => {
    debouncedSaveContentRef.current?.flush();
    debouncedSaveCollabProjectionRef.current?.flush();
    flushBodyToCacheRef.current();
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

  const collabEnabled =
    !isEditingTemplate &&
    crossScopeAccess !== "denied" &&
    Boolean(session.userId);

  const contentReady =
    document == null || contentHydratedForId === document.id;

  const collabStackReady =
    document != null &&
    (collabBootstrappedForId === document.id || isCollabBootstrapped(document.id));

  const waitingForCollabStack =
    collabEnabled &&
    document != null &&
    !collabStackReady &&
    !collabDocReady;

  const blockingLoad = isEditingTemplate
    ? templateLoading ||
      !templateRecord ||
      contentHydratedForId !== templateHydrationKey
    : !resolvedId ||
      (!effectiveWorkspaceId && !document) ||
      (!browserOffline && crossScopeAccess === "pending") ||
      (!document && loading) ||
      (document != null && !contentReady) ||
      waitingForCollabStack;

  const templateShellKey = isEditingTemplate
    ? `template:${requestedTemplateId ?? ""}`
    : null;
  const documentShellKey = document?.id ?? resolvedId;

  useLayoutEffect(() => {
    if (blockingLoad) return;
    if (isEditingTemplate) {
      if (templateShellKey) {
        markEditorShellRevealed(templateShellKey);
      }
      return;
    }
    if (documentShellKey) {
      markEditorShellRevealed(documentShellKey);
    }
  }, [blockingLoad, documentShellKey, isEditingTemplate, templateShellKey]);

  const reloadRemoteDocument = useCallback(async () => {
    if (!document?.id) return null;
    const result = await fetchDocumentMetadata(document.id, {
      ifNoneMatchUpdatedAt: document.updated_at,
    });
    if (result.kind === "not_modified") {
      return document;
    }
    if (result.kind === "error") {
      return null;
    }
    await applyRemoteDocument(result.document);
    return result.document;
  }, [applyRemoteDocument, document]);

  return {
    document: document as DocumentRecord | null,
    documentId: isEditingTemplate ? null : (document?.id ?? resolvedId),
    documentScopeLabel,
    shareContext,
    canEditDocument,
    refreshShareContext,
    workspaceId: isEditingTemplate
      ? (templateRecord?.workspace_id ?? effectiveWorkspaceId)
      : (document?.workspace_id ?? effectiveWorkspaceId ?? null),
    loading: blockingLoad,
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
    onDocumentImageInserted: handleDocumentImageInserted,
    collabActive,
    collabPeersPresent,
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
    isOffline: browserOffline,
    flushEditorBodySave,
  };
}
