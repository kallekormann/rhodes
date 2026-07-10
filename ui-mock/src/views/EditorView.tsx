import { SlidersHorizontal, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { getScopeMetaLabel } from "../data/scopes";
import { EditorBody } from "../components/EditorBody";
import type { BubbleMenuPlacement } from "../components/BubbleMenu";
import { IconLabelButton } from "../components/IconLabelButton";
import { InsightDot } from "../components/InsightDot";
import { RightPanel } from "../components/RightPanel";
import "./EditorView.css";

const SCROLL_TOP_THRESHOLD = 16;
const SCROLL_HIDE_OFFSET = 48;
const SCROLLBAR_FADE_MS = 900;

export function EditorView() {
  const {
    documentTitle,
    setDocumentTitle,
    panelOpen,
    headerHidden,
    setHeaderHidden,
    setShowBubble,
    showBubble,
    openPanel,
    panelTab,
    documentId,
    isFavorite,
    toggleFavorite,
    activeScope,
  } = useApp();

  const canvasRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const scrollFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [bubblePlacement, setBubblePlacement] = useState<BubbleMenuPlacement>("above");

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
            <input
              type="text"
              className="editor-content__title"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="Untitled"
              aria-label="Document title"
            />
            <div className="editor-content__meta">
              <span>Updated 8 min ago</span>
              <span className="editor-content__meta-sep" aria-hidden="true">
                ·
              </span>
              <IconLabelButton variant="meta">
                {getScopeMetaLabel(activeScope)}
              </IconLabelButton>
              <span className="editor-content__meta-sep" aria-hidden="true">
                ·
              </span>
              <IconLabelButton
                variant="meta"
                icon={Star}
                active={isFavorite(documentId)}
                onClick={() => toggleFavorite(documentId)}
              >
                Favorite
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
            <hr className="editor-content__rule" />
            </div>
            <div className="editor-content__gutter" aria-hidden="true" />
          </header>

          <EditorBody
            showBubble={showBubble}
            setShowBubble={setShowBubble}
            bubblePlacement={bubblePlacement}
            setBubblePlacement={setBubblePlacement}
            onAsk={() => openPanel("ask")}
          />
        </article>

        {!panelOpen && <InsightDot />}
      </div>
      <RightPanel />
    </div>
  );
}
