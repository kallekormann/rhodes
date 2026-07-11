"use client";

import { LayoutTemplate, MessageSquare, SlidersHorizontal, Star } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { getScopeMetaLabel } from "@/data/scopes";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { EditorTitleField } from "@/components/EditorTitleField";
import { IconLabelButton } from "@/components/IconLabelButton";
import { InsightDot } from "@/components/InsightDot";
import { RightPanel } from "@/components/RightPanel";
import { SharePopover } from "@/components/SharePopover";
import { useEditorSession } from "@/hooks/useEditorSession";
import { getCommentIdsToRemove } from "@/lib/documents/comments";
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
    activeScope,
  } = useApp();

  const {
    loading,
    error,
    content,
    documentId,
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
    onTemplateDescriptionChange,
    onTemplateMetadataChange,
  } = useEditorSession();

  const [shareOpen, setShareOpen] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [hoverCommentId, setHoverCommentId] = useState<string | null>(null);
  const scrollToCommentRef = useRef<(commentId: string) => void>(() => {});

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onScroll = () => {
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
  }, [setHeaderHidden]);

  const canvasClass = [
    "editor-view__canvas",
    "overlay-scrollbar",
    !headerHidden && "editor-view__canvas--header-visible",
    isScrolling && "is-scrolling",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`editor-view ${panelOpen ? "editor-view--panel-open" : ""}`}>
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
              <div className="editor-content__meta-row">
              {!isTemplateMode && (
                <>
              <div className="editor-content__share-anchor">
                <IconLabelButton
                  variant="meta"
                  active={shareOpen}
                  onClick={() => setShareOpen((open) => !open)}
                >
                  {getScopeMetaLabel(activeScope)}
                </IconLabelButton>
                {shareOpen && documentId && (
                  <div className="editor-content__share-popover">
                    <SharePopover
                      documentId={documentId}
                      onClose={() => setShareOpen(false)}
                    />
                  </div>
                )}
              </div>
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
            <p className="caption editor-content__loading">Loading document…</p>
          ) : error ? (
            <p className="caption editor-content__loading">{error}</p>
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
                  onAsk={() => openPanel("ask")}
                  selectedCommentId={selectedCommentId}
                  hoverCommentId={hoverCommentId}
                  scrollContainerRef={canvasRef}
                  onCommentHighlightClick={
                    isTemplateMode ? undefined : handleCommentHighlightClick
                  }
                  onRegisterScrollToComment={(scrollToComment) => {
                    scrollToCommentRef.current = scrollToComment;
                  }}
                />
              </div>
              <div className="editor-content__gutter" aria-hidden="true" />
            </div>
          )}
        </article>

        {!panelOpen && <InsightDot />}
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
        documentMetadata={documentMetadata}
        createdAtLabel={createdAtLabel}
        createdByLabel={createdByLabel}
        templateDescription={templateDescription}
        templateMetadata={templateMetadata}
        onMetadataFieldChange={onMetadataFieldChange}
        onTemplateDescriptionChange={onTemplateDescriptionChange}
        onTemplateMetadataChange={onTemplateMetadataChange}
      />
    </div>
  );
}

export function EditorView() {
  return (
    <Suspense fallback={<p className="caption">Loading editor…</p>}>
      <EditorViewContent />
    </Suspense>
  );
}
