"use client";

import { LayoutTemplate, MessageSquare, SlidersHorizontal, Star } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { LoaderState } from "@/components/Loader";
import { DocumentShareBadge } from "@/components/DocumentShareBadge";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { EditorTitleField } from "@/components/EditorTitleField";
import { IconLabelButton } from "@/components/IconLabelButton";
import { RhodesActivityRail } from "@/components/rhodes-activity/RhodesActivityRail";
import { useRhodesDocumentActivity } from "@/hooks/useRhodesDocumentActivity";
import { useWritingCoach } from "@/hooks/useWritingCoach";
import { RightPanel } from "@/components/RightPanel";
import { SharePopover } from "@/components/SharePopover";
import { useEditorSession } from "@/hooks/useEditorSession";
import { useInsights } from "@/hooks/useInsights";
import { getCommentIdsToRemove } from "@/lib/documents/comments";
import type { CitationInsertInput } from "@/lib/documents/editor-commands";
import type { PropertiesPanelStage } from "@/components/PropertiesTab";
import "./EditorView.css";

const SCROLL_TOP_THRESHOLD = 16;
const SCROLL_HIDE_OFFSET = 48;
const SCROLLBAR_FADE_MS = 900;

function EditorViewContent() {
  const {
    documentTitle,
    panelOpen,
    headerHidden,
    setHeaderHidden,
    openPanel,
    panelTab,
  } = useApp();

  const {
    loading,
    content,
    contentPlain,
    documentId,
    documentScopeLabel,
    shareContext,
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
  } = useEditorSession();

  const {
    insights,
    loading: insightsLoading,
    error: insightsError,
  } = useInsights(
    isTemplateMode ? null : workspaceId,
    contentPlain,
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
  const scrollToCommentRef = useRef<(commentId: string) => void>(() => {});
  const insertCitationRef = useRef<(input: CitationInsertInput) => void>(() => {});

  const handleOpenAsk = useCallback(
    (selectedText?: string) => {
      if (selectedText) setAskPrefill(selectedText);
      openPanel("ask");
    },
    [openPanel],
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

  useEffect(() => {
    if (propertiesStage !== "view") {
      setHeaderHidden(false);
    }
  }, [propertiesStage, setHeaderHidden]);

  useEffect(() => {
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
  }, [propertiesStage, setHeaderHidden]);

  const canvasClass = [
    "editor-view__canvas",
    "overlay-scrollbar",
    !headerHidden && "editor-view__canvas--header-visible",
    isScrolling && "is-scrolling",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`editor-view ${panelOpen ? "editor-view--panel-open" : ""}`}
    >
      <div ref={canvasRef} className={canvasClass}>
        <article className="editor-content">
          <header className="editor-content__header">
            <div className="editor-content__gutter" aria-hidden="true" />
            <div className="editor-content__main">
            <EditorTitleField
              value={documentTitle}
              onChange={onTitleChange}
              placeholder={isTemplateMode ? "Template name" : "Untitled"}
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
                onClick={() => openPanel("properties")}
              >
                Properties
              </IconLabelButton>
              </div>
            </div>
            <hr className="editor-content__rule" />
            </div>
            <div className="editor-content__gutter" aria-hidden="true" />
          </header>

          {loading ? (
            <div className="editor-content__body">
              <div className="editor-content__gutter" aria-hidden="true" />
              <div className="editor-content__main editor-content__main--body">
                <LoaderState
                  label="Loading document…"
                  size="m"
                  align="start"
                  className="editor-content__loading"
                />
              </div>
              <div className="editor-content__gutter" aria-hidden="true" />
            </div>
          ) : (
            <div className="editor-content__body">
              <div className="editor-content__gutter" aria-hidden="true" />
              <div className="editor-content__main editor-content__main--body">
                <TipTapEditor
                  key={documentId ?? "template"}
                  content={content}
                  documentId={documentId}
                  workspaceId={workspaceId}
                  comments={isTemplateMode ? [] : comments}
                  onAddComment={isTemplateMode ? undefined : addComment}
                  onCommentsDocumentSync={
                    isTemplateMode ? undefined : syncCommentsFromEditor
                  }
                  onUpdate={handleContentUpdate}
                  onAsk={handleOpenAsk}
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
                  onRegisterEditor={registerEditor}
                  onBlur={() => {
                    void evaluateOnBlur();
                  }}
                />
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
        workspaceId={workspaceId}
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
        insights={insights}
        insightsLoading={insightsLoading}
        insightsError={insightsError}
        insightsQueryText={contentPlain}
        askPrefill={askPrefill}
        onConsumeAskPrefill={() => setAskPrefill("")}
        onInsertCitation={isTemplateMode ? undefined : handleInsertCitation}
      />
    </div>
  );
}

export function EditorView() {
  return (
    <Suspense
      fallback={
        <LoaderState label="Loading editor…" size="m" className="editor-suspense-fallback" />
      }
    >
      <EditorViewContent />
    </Suspense>
  );
}
