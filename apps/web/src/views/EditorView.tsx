"use client";

import { LayoutTemplate, SlidersHorizontal, Star } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { getScopeMetaLabel } from "@/data/scopes";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { EditorTitleField } from "@/components/EditorTitleField";
import { IconLabelButton } from "@/components/IconLabelButton";
import { InsightDot } from "@/components/InsightDot";
import { RightPanel } from "@/components/RightPanel";
import { SharePopover } from "@/components/SharePopover";
import { useEditorSession } from "@/hooks/useEditorSession";
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
    onContentUpdate: handleContentUpdate,
    onTitleChange,
  } = useEditorSession();

  const [shareOpen, setShareOpen] = useState(false);

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
                  onUpdate={handleContentUpdate}
                  onAsk={() => openPanel("ask")}
                />
              </div>
              <div className="editor-content__gutter" aria-hidden="true" />
            </div>
          )}
        </article>

        {!panelOpen && <InsightDot />}
      </div>
      <RightPanel />
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
