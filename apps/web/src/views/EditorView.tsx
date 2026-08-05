"use client";

import { LayoutTemplate, MessageSquare, SlidersHorizontal, Star } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { LoaderState } from "@/components/Loader";
import { DocumentShareBadge } from "@/components/DocumentShareBadge";
import { DocumentAwayNoticeBanner } from "@/components/DocumentEditorPresence";
import { ConflictCompareModal } from "@/components/ConflictCompareModal";
import { DocumentConflictFloat } from "@/components/DocumentConflictFloat";
import type { Editor } from "@tiptap/react";
import { scrollEditorToExcerpt } from "@/lib/documents/comment-navigation";
import type { ActivityNavigateTarget } from "@/components/DocumentHistorySection";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";
import { conflictReviewColors } from "@/lib/offline/conflict-review-colors";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { EditorTitleField } from "@/components/EditorTitleField";
import { IconLabelButton } from "@/components/IconLabelButton";
import { RhodesActivityRail } from "@/components/rhodes-activity/RhodesActivityRail";
import { useRhodesDocumentActivity } from "@/hooks/useRhodesDocumentActivity";
import { useWritingCoach } from "@/hooks/useWritingCoach";
import { RightPanel } from "@/components/RightPanel";
import { SharePopover } from "@/components/SharePopover";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { useEditorSession } from "@/hooks/useEditorSession";
import { useClientHydrated } from "@/hooks/useClientHydrated";
import { isEditorShellRevealed } from "@/lib/editor/editor-shell-session";
import { EditorErrorBoundary } from "@/components/EditorErrorBoundary";
import { useInsights } from "@/hooks/useInsights";
import { getCommentIdsToRemove } from "@/lib/documents/comments";
import type { CitationInsertInput } from "@/lib/documents/editor-commands";
import type { PropertiesPanelStage } from "@/components/PropertiesTab";
import "./EditorView.css";

const SCROLL_TOP_THRESHOLD = 16;
const SCROLL_HIDE_OFFSET = 48;
const SCROLLBAR_FADE_MS = 900;

function EditorViewContent({
  documentId: embeddedDocumentId,
  embedded = false,
}: {
  documentId?: string | null;
  embedded?: boolean;
} = {}) {
  const {
    documentTitle,
    panelOpen,
    headerHidden,
    setHeaderHidden,
    openPanel,
    panelTab,
    workspaceId: activeScopeId,
  } = useApp();

  const {
    loading,
    error: sessionError,
    content,
    contentPlain,
    documentId,
    documentScopeLabel,
    shareContext,
    canEditDocument,
    refreshShareContext,
    workspaceId,
    createdAtLabel,
    updatedAtLabel,
    isFavorite,
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
    onTitleChange,
    documentMetadata,
    createdByLabel,
    templateDescription,
    templateMetadata,
    onMetadataFieldChange,
    onMetadataGroupInstancesChange,
    onTemplateDescriptionChange,
    onTemplateMetadataChange,
    metadataSchemas,
    metadataGroups,
    metadataSchemasLoading,
    createMetadataSchema,
    createMetadataGroup,
    updateMetadataSchema,
    updateMetadataGroup,
    deleteMetadataSchema,
    deleteMetadataGroup,
    awayNotice,
    dismissAwayNotice,
    reloadRemoteDocument,
    contentSyncToken,
    lockedBlockId,
    lockedBlockIndex,
    lockedSelectionFrom,
    lockedByName,
    remoteCursors,
    onEditorSelectionChange,
    onActiveBlockChange,
    ydoc,
    collabProvider,
    collabDocReady,
    collabSynced,
    collabNeedsInitialSeed,
    onCollabBootstrapped,
    onDocumentImageInserted,
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
    isOffline,
    flushEditorBodySave,
  } = useEditorSession(
    embedded
      ? { embedded: true, documentId: embeddedDocumentId ?? null }
      : {},
  );

  const hydrated = useClientHydrated();

  const editorEditable =
    (isTemplateMode || canEditDocument) && !offlineConflictReviewPending;

  const offlineConflictColors = useMemo(() => {
    const peerUserIds = [
      ...new Set(
        offlineConflictReviews.flatMap((review) =>
          (review.peerContributors ?? []).map((peer) => peer.userId),
        ),
      ),
    ];
    if (peerUserIds.length === 0) {
      for (const cursor of remoteCursors) {
        peerUserIds.push(cursor.userId);
      }
    }
    return conflictReviewColors({
      localUserId: collaborationUser?.userId,
      peerUserIds,
    });
  }, [collaborationUser?.userId, offlineConflictReviews, remoteCursors]);

  const {
    insights,
    loading: insightsLoading,
    error: insightsError,
    refresh: refreshInsights,
  } = useInsights(
    isTemplateMode ? null : activeScopeId,
    contentPlain,
    3000,
    isTemplateMode ? null : documentId || null,
  );

  const {
    processing: rhodesProcessing,
    processingLabel,
    propertiesNotice,
    dismissPropertiesNotice,
  } = useRhodesDocumentActivity({
    documentId: isTemplateMode ? null : documentId,
    documentMetadata,
    contentPlain,
    insightsLoading,
  });

  const writingCoachEnabled = !isTemplateMode && !loading && !panelOpen;
  const {
    registerEditor,
    evaluateOnBlur,
    suggestion: writingSuggestion,
    loading: writingLoading,
    open: writingOpen,
    toggleWriting,
    dismissWriting,
    acceptWriting,
  } = useWritingCoach(writingCoachEnabled);

  const [shareOpen, setShareOpen] = useState(false);
  const [askPrefill, setAskPrefill] = useState("");
  const [propertiesStage, setPropertiesStage] = useState<PropertiesPanelStage>("view");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [hoverCommentId, setHoverCommentId] = useState<string | null>(null);
  const [activeConflictClusterId, setActiveConflictClusterId] = useState<
    string | null
  >(null);
  const [conflictCompareOpen, setConflictCompareOpen] = useState(false);
  const scrollToCommentRef = useRef<(commentId: string) => void>(() => {});
  const insertCitationRef = useRef<(input: CitationInsertInput) => void>(() => {});
  const editorRef = useRef<Editor | null>(null);

  const handleRegisterEditor = useCallback(
    (editor: Editor | null) => {
      editorRef.current = editor;
      registerEditorForConflict(editor);
      registerEditor(editor);
    },
    [registerEditor, registerEditorForConflict],
  );

  const handleNavigateToActivity = useCallback((target: ActivityNavigateTarget) => {
    const editor = editorRef.current;
    if (!editor || target.eventType !== "content_edited") return;

    const excerpt = target.payload.excerpt;
    if (typeof excerpt !== "string") return;
    scrollEditorToExcerpt(editor, excerpt);
  }, []);

  useEffect(() => {
    if (offlineConflictClusters.length === 0) {
      setActiveConflictClusterId(null);
      setConflictCompareOpen(false);
      return;
    }
    setActiveConflictClusterId((current) => {
      if (current && offlineConflictClusters.some((c) => c.id === current)) {
        return current;
      }
      return offlineConflictClusters[0]?.id ?? null;
    });
  }, [offlineConflictClusters]);

  const activeConflictCluster =
    offlineConflictClusters.find((c) => c.id === activeConflictClusterId) ??
    offlineConflictClusters[0] ??
    null;

  const scrollToConflictCluster = useCallback((cluster: SpanConflictCluster) => {
    const target = document.querySelector(
      `[data-cluster-id="${cluster.id}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleShowConflictCluster = useCallback(
    (cluster: SpanConflictCluster) => {
      setActiveConflictClusterId(cluster.id);
      scrollToConflictCluster(cluster);
      setConflictCompareOpen(true);
    },
    [scrollToConflictCluster],
  );

  const handleActivateConflictCluster = useCallback(
    (clusterId: string) => {
      setActiveConflictClusterId(clusterId);
      const cluster = offlineConflictClusters.find((c) => c.id === clusterId);
      if (cluster) scrollToConflictCluster(cluster);
      setConflictCompareOpen(true);
    },
    [offlineConflictClusters, scrollToConflictCluster],
  );

  const handleKeepConflictCluster = useCallback(
    (clusterId: string) => {
      void resolveOfflineCluster(clusterId, "mine");
      setConflictCompareOpen(false);
    },
    [resolveOfflineCluster],
  );

  const handleDismissConflictCluster = useCallback(
    (clusterId: string) => {
      void resolveOfflineCluster(clusterId, "theirs");
      setConflictCompareOpen(false);
    },
    [resolveOfflineCluster],
  );

  const handleOpenAsk = useCallback(
    (selectedText?: string) => {
      if (isOffline) return;
      if (selectedText) setAskPrefill(selectedText);
      openPanel("ask");
    },
    [isOffline, openPanel],
  );

  const handleInsertCitation = useCallback((input: CitationInsertInput) => {
    insertCitationRef.current(input);
  }, []);

  const selectComment = useCallback(
    (
      commentId: string | null,
      options?: { scroll?: boolean; openPanel?: boolean },
    ) => {
      setSelectedCommentId(commentId);
      if (options?.openPanel) {
        openPanel("comments");
      }
      if (commentId && options?.scroll !== false) {
        scrollToCommentRef.current(commentId);
      }
    },
    [openPanel],
  );

  const handleCommentHighlightClick = useCallback(
    (commentId: string) => {
      setHoverCommentId(null);
      selectComment(commentId, { openPanel: true, scroll: true });
    },
    [selectComment],
  );

  const handleSelectCommentFromPanel = useCallback(
    (commentId: string) => {
      setHoverCommentId(null);
      selectComment(commentId, { scroll: true, openPanel: false });
    },
    [selectComment],
  );

  const handleOpenCommentsPanel = useCallback(() => {
    openPanel("comments");
  }, [openPanel]);

  const handleRemoveComment = useCallback(
    (commentId: string) => {
      const idsToRemove = getCommentIdsToRemove(comments, commentId);
      removeComment(commentId);
      setSelectedCommentId((current) =>
        current && idsToRemove.has(current) ? null : current,
      );
      setHoverCommentId((current) =>
        current && idsToRemove.has(current) ? null : current,
      );
    },
    [comments, removeComment],
  );

  useEffect(() => {
    setSelectedCommentId(null);
    setHoverCommentId(null);
  }, [documentId]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const scrollFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [canvasTransitionsEnabled, setCanvasTransitionsEnabled] =
    useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCanvasTransitionsEnabled(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (propertiesStage !== "view") {
      setHeaderHidden(false);
    }
  }, [propertiesStage, setHeaderHidden]);

  useEffect(() => {
    if (embedded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onScroll = () => {
      if (propertiesStage !== "view") return;

      const scrollTop = canvas.scrollTop;

      if (scrollTop <= SCROLL_TOP_THRESHOLD) {
        setHeaderHidden(false);
      } else if (scrollTop > lastScrollTop.current && scrollTop > SCROLL_HIDE_OFFSET) {
        setHeaderHidden(true);
      }

      lastScrollTop.current = scrollTop;

      setIsScrolling(true);
      if (scrollFadeTimer.current) clearTimeout(scrollFadeTimer.current);
      scrollFadeTimer.current = setTimeout(() => {
        setIsScrolling(false);
      }, SCROLLBAR_FADE_MS);
    };

    canvas.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      canvas.removeEventListener("scroll", onScroll);
      if (scrollFadeTimer.current) clearTimeout(scrollFadeTimer.current);
      setHeaderHidden(false);
    };
  }, [embedded, propertiesStage, setHeaderHidden]);

  const canvasClass = [
    "editor-view__canvas",
    "overlay-scrollbar",
    !embedded && !headerHidden && "editor-view__canvas--header-visible",
    canvasTransitionsEnabled && "editor-view__canvas--transitions",
    isScrolling && "is-scrolling",
  ]
    .filter(Boolean)
    .join(" ");

  const editorShellSticky =
    hydrated &&
    documentId != null &&
    isEditorShellRevealed(documentId);
  const collabBodyPending = ydoc != null && !collabDocReady;
  const bodyReady = !loading && !collabBodyPending;
  const showInitialBodyLoader = !bodyReady && !editorShellSticky;
  const hasKnownTitle =
    documentTitle.trim().length > 0 && documentTitle !== "Untitled Document";
  const displayTitle = showInitialBodyLoader && !hasKnownTitle ? "" : documentTitle;
  const titlePlaceholder =
    isTemplateMode
      ? "Template name"
      : showInitialBodyLoader && !hasKnownTitle
        ? "Loading document…"
        : "Untitled";

  return (
    <div
      className={[
        "editor-view",
        panelOpen ? "editor-view--panel-open" : "",
        embedded ? "editor-view--embedded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div ref={canvasRef} className={canvasClass}>
        <article className="editor-content">
          <header className="editor-content__header">
            <div className="editor-content__gutter" aria-hidden="true" />
            <div className="editor-content__main">
            <EditorTitleField
              value={displayTitle}
              onChange={onTitleChange}
              placeholder={titlePlaceholder}
              aria-label={isTemplateMode ? "Template name" : "Document title"}
              disabled={loading}
            />
            <div className="editor-content__meta">
              <div className="editor-content__meta-row">
                {createdAtLabel && <span>{createdAtLabel}</span>}
                {createdAtLabel && (
                  <span className="editor-content__meta-sep" aria-hidden="true">
                    ·
                  </span>
                )}
                <span>{updatedAtLabel ?? "Updated just now"}</span>
                {!isTemplateMode && documentId && (
                  <>
                    <span className="editor-content__meta-sep" aria-hidden="true">
                      ·
                    </span>
                    <SyncStatusIndicator
                      documentId={documentId}
                      workspaceId={workspaceId}
                    />
                  </>
                )}
              </div>
              <div className="editor-content__meta-row editor-content__meta-row--scope">
              {!isTemplateMode && (
                <>
              <div className="editor-content__share-anchor">
                <IconLabelButton
                  variant="meta"
                  active={shareOpen}
                  onClick={() => setShareOpen((open) => !open)}
                >
                  {documentScopeLabel ?? "Document scope"}
                </IconLabelButton>
                {shareOpen && documentId && (
                  <div className="editor-content__share-popover">
                    <SharePopover
                      documentId={documentId}
                      onClose={() => setShareOpen(false)}
                      onSharesChange={refreshShareContext}
                    />
                  </div>
                )}
              </div>
              <DocumentShareBadge context={shareContext} />
              <span className="editor-content__meta-sep" aria-hidden="true">
                ·
              </span>
              <IconLabelButton
                variant="meta"
                icon={Star}
                active={isFavorite}
                onClick={toggleFavorite}
              >
                Favorite
              </IconLabelButton>
              <span className="editor-content__meta-sep" aria-hidden="true">
                ·
              </span>
                </>
              )}
              <IconLabelButton
                variant="meta"
                icon={LayoutTemplate}
                onClick={() => void saveAsTemplate()}
              >
                {publishingTemplate
                  ? "Saving…"
                  : isEditingTemplate
                    ? "Save template"
                    : isTemplateDraft
                      ? "Publish template"
                      : "Save as template"}
              </IconLabelButton>
              {!isTemplateMode && comments.length > 0 && (
                <>
                  <span className="editor-content__meta-sep" aria-hidden="true">
                    ·
                  </span>
                  <IconLabelButton
                    variant="meta"
                    icon={MessageSquare}
                    active={panelOpen && panelTab === "comments"}
                    onClick={handleOpenCommentsPanel}
                  >
                    Comments ({comments.length})
                  </IconLabelButton>
                </>
              )}
              <span className="editor-content__meta-sep" aria-hidden="true">
                ·
              </span>
              <IconLabelButton
                variant="meta"
                icon={SlidersHorizontal}
                active={panelOpen && panelTab === "properties"}
                disabled={isOffline}
                title={
                  isOffline
                    ? "Properties offline — you can still write"
                    : undefined
                }
                onClick={() => {
                  if (isOffline) return;
                  openPanel("properties");
                }}
              >
                Properties
              </IconLabelButton>
              </div>
            </div>
            <hr className="editor-content__rule" />
            </div>
            <div className="editor-content__gutter" aria-hidden="true" />
          </header>

          {sessionError && !documentId && !isEditingTemplate ? (
            <div className="editor-content__body">
              <div className="editor-content__gutter" aria-hidden="true" />
              <div className="editor-content__main editor-content__main--body">
                <div className="editor-content__load-error" role="alert">
                  <p className="editor-content__load-error-title">
                    Couldn&apos;t open this document
                  </p>
                  <p className="editor-content__load-error-message">
                    {sessionError}
                  </p>
                  <p className="caption">
                    Run <code>await __rhodesCopyErrors()</code> in the console
                    (works offline), or{" "}
                    <code>
                      await __rhodesInspectDoc(&apos;{documentId ?? "DOC_ID"}&apos;)
                    </code>
                  </p>
                </div>
              </div>
              <div className="editor-content__gutter" aria-hidden="true" />
            </div>
          ) : (
            <div className="editor-content__body">
              <div className="editor-content__gutter" aria-hidden="true" />
              <div className="editor-content__main editor-content__main--body editor-content__main--body-host">
                {showInitialBodyLoader && (
                  <LoaderState
                    label="Loading document…"
                    size="m"
                    align="start"
                    className="editor-content__loading-overlay"
                  />
                )}
                {!showInitialBodyLoader && (
                  <>
                {awayNotice && (
                  <DocumentAwayNoticeBanner
                    notice={awayNotice}
                    onDismiss={dismissAwayNotice}
                  />
                )}
                {offlineConflictReviewPending && offlineConflictClusters.length > 0 && (
                  <DocumentConflictFloat
                    clusters={offlineConflictClusters}
                    reviews={offlineConflictReviews}
                    activeClusterId={activeConflictClusterId}
                    onActiveClusterChange={setActiveConflictClusterId}
                    onShowConflict={handleShowConflictCluster}
                    onKeep={handleKeepConflictCluster}
                    onDismiss={handleDismissConflictCluster}
                  />
                )}
                {!editorEditable && (
                  <p className="editor-content__read-only-banner caption" role="status">
                    You have view-only access to this document.
                  </p>
                )}
                <EditorErrorBoundary documentId={documentId}>
                <TipTapEditor
                  key={documentId ?? "template"}
                  content={content}
                  contentSyncToken={contentSyncToken}
                  ydoc={ydoc}
                  collabProvider={collabProvider}
                  collabDocReady={collabDocReady}
                  collabSynced={collabSynced}
                  collabNeedsInitialSeed={collabNeedsInitialSeed}
                  onCollabBootstrapped={onCollabBootstrapped}
                  onDocumentImageInserted={onDocumentImageInserted}
                  collaborationUser={collaborationUser}
                  lockedBlockId={lockedBlockId}
                  lockedBlockIndex={lockedBlockIndex}
                  lockedSelectionFrom={lockedSelectionFrom}
                  lockedByName={lockedByName}
                  remoteCursors={remoteCursors}
                  documentId={documentId}
                  workspaceId={workspaceId}
                  editable={editorEditable}
                  comments={isTemplateMode ? [] : comments}
                  onAddComment={isTemplateMode ? undefined : addComment}
                  onCommentsDocumentSync={
                    isTemplateMode ? undefined : syncCommentsFromEditor
                  }
                  onUpdate={handleContentUpdate}
                  onAsk={handleOpenAsk}
                  askOffline={isOffline}
                  selectedCommentId={selectedCommentId}
                  hoverCommentId={hoverCommentId}
                  scrollContainerRef={canvasRef}
                  onCommentHighlightClick={
                    isTemplateMode ? undefined : handleCommentHighlightClick
                  }
                  onRegisterScrollToComment={(scrollToComment) => {
                    scrollToCommentRef.current = scrollToComment;
                  }}
                  onRegisterInsertCitation={(insertCitation) => {
                    insertCitationRef.current = insertCitation;
                  }}
                  onRegisterEditor={handleRegisterEditor}
                  onActiveBlockChange={onActiveBlockChange}
                  onSelectionChange={onEditorSelectionChange}
                  offlineConflictClusters={offlineConflictClusters}
                  offlineConflictReviews={offlineConflictReviews}
                  conflictReviewColors={offlineConflictColors}
                  activeOfflineConflictClusterId={activeConflictClusterId}
                  onActivateOfflineConflictCluster={handleActivateConflictCluster}
                  onResolveOfflineCluster={resolveOfflineCluster}
                  onBlur={() => {
                    flushEditorBodySave();
                    void evaluateOnBlur();
                  }}
                />
                </EditorErrorBoundary>
                  </>
                )}
              </div>
              <div className="editor-content__gutter" aria-hidden="true" />
            </div>
          )}
        </article>

        {!panelOpen && !isTemplateMode && (
          <RhodesActivityRail
            processing={rhodesProcessing}
            processingLabel={processingLabel}
            insightCount={insights.length}
            propertiesNotice={propertiesNotice}
            onDismissProperties={dismissPropertiesNotice}
            writingSuggestion={writingSuggestion}
            writingOpen={writingOpen}
            writingLoading={writingLoading}
            onToggleWriting={toggleWriting}
            onDismissWriting={dismissWriting}
            onAcceptWriting={acceptWriting}
          />
        )}
      </div>
      <RightPanel
        comments={isTemplateMode ? [] : comments}
        selectedCommentId={selectedCommentId}
        hoverCommentId={hoverCommentId}
        onSelectComment={handleSelectCommentFromPanel}
        onHoverComment={setHoverCommentId}
        onAddReply={isTemplateMode ? () => {} : addReply}
        onRemoveComment={isTemplateMode ? () => {} : handleRemoveComment}
        workspaceId={activeScopeId}
        propertiesMode={isEditingTemplate ? "template" : "document"}
        propertiesStage={propertiesStage}
        onPropertiesStageChange={setPropertiesStage}
        documentMetadata={documentMetadata}
        createdAtLabel={createdAtLabel}
        createdByLabel={createdByLabel}
        templateDescription={templateDescription}
        templateMetadata={templateMetadata}
        onMetadataFieldChange={onMetadataFieldChange}
        onMetadataGroupInstancesChange={onMetadataGroupInstancesChange}
        onTemplateDescriptionChange={onTemplateDescriptionChange}
        onTemplateMetadataChange={onTemplateMetadataChange}
        metadataSchemas={metadataSchemas}
        metadataGroups={metadataGroups}
        metadataSchemasLoading={metadataSchemasLoading}
        createMetadataSchema={createMetadataSchema}
        createMetadataGroup={createMetadataGroup}
        updateMetadataSchema={updateMetadataSchema}
        updateMetadataGroup={updateMetadataGroup}
        deleteMetadataSchema={deleteMetadataSchema}
        deleteMetadataGroup={deleteMetadataGroup}
        documentId={isTemplateMode ? null : documentId}
        onVersionRestored={() => {
          void reloadRemoteDocument();
        }}
        onNavigateToActivity={handleNavigateToActivity}
        insights={insights}
        insightsLoading={insightsLoading}
        insightsError={insightsError}
        insightsQueryText={contentPlain}
        onRetryInsights={() => void refreshInsights()}
        askPrefill={askPrefill}
        onConsumeAskPrefill={() => setAskPrefill("")}
        onInsertCitation={isTemplateMode ? undefined : handleInsertCitation}
        offsetForAppHeader={embedded ? false : undefined}
        readOnlyFieldKeys={embedded ? ["origin"] : undefined}
        fieldHints={
          embedded
            ? {
                origin:
                  "Wiki parent — drag the page in the tree to reparent. Clearing Origin would remove it from this Space.",
              }
            : undefined
        }
      />

      <ConflictCompareModal
        cluster={activeConflictCluster}
        reviews={offlineConflictReviews}
        colors={offlineConflictColors}
        open={conflictCompareOpen && offlineConflictReviewPending}
        onClose={() => setConflictCompareOpen(false)}
        onKeep={() => {
          if (!activeConflictCluster) return;
          handleKeepConflictCluster(activeConflictCluster.id);
        }}
        onDismiss={() => {
          if (!activeConflictCluster) return;
          handleDismissConflictCluster(activeConflictCluster.id);
        }}
      />
    </div>
  );
}

export function EditorView() {
  return (
    <Suspense
      fallback={
        <LoaderState
          label="Loading editor…"
          size="m"
          align="fill"
          className="editor-suspense-fallback"
        />
      }
    >
      <EditorViewContent />
    </Suspense>
  );
}

/** Full document workspace hosted inside another view (Wiki). Does not own URL. */
export function EmbeddedDocumentEditor({
  documentId,
}: {
  documentId: string;
}) {
  return (
    <Suspense
      fallback={
        <LoaderState
          label="Loading document…"
          size="m"
          align="fill"
          className="editor-suspense-fallback"
        />
      }
    >
      <EditorViewContent documentId={documentId} embedded />
    </Suspense>
  );
}
