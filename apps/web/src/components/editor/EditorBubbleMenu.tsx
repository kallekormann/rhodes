"use client";

import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BubbleMenu as BubbleMenuChrome,
  type BubbleActiveMark,
  type BubbleMenuPlacement,
} from "@/components/BubbleMenu";
import type { LinkMode } from "@/components/LinkPopover";
import {
  computeBubbleMenuPosition,
  getRangeRect,
  getSelectionRect,
} from "@/lib/documents/menu-position";
import "./EditorBubbleMenu.css";

type EditorBubbleMenuProps = {
  editor: Editor;
  onAsk?: (selectedText?: string) => void;
  workspaceId?: string | null;
  documentId?: string | null;
  onCommentSave?: (text: string, range: { from: number; to: number }) => void;
};

type BubbleState = {
  top: number;
  left: number;
  placement: BubbleMenuPlacement;
};

function getActiveMarks(editor: Editor): BubbleActiveMark[] {
  const marks: BubbleActiveMark[] = [];
  if (editor.isActive("bold")) marks.push("bold");
  if (editor.isActive("italic")) marks.push("italic");
  if (editor.isActive("link")) marks.push("link");
  if (editor.isActive("blockquote")) marks.push("quote");
  if (editor.isActive("heading", { level: 2 })) marks.push("heading");
  if (editor.isActive("bulletList")) marks.push("bulletList");
  if (editor.isActive("orderedList")) marks.push("orderedList");
  return marks;
}

function shouldShowBubble(editor: Editor): boolean {
  const { selection } = editor.state;
  if (selection.empty || selection instanceof NodeSelection) return false;
  if (selection.from === selection.to) return false;
  if (editor.isActive("codeBlock")) return false;
  return true;
}

export function EditorBubbleMenu({
  editor,
  onAsk,
  workspaceId,
  documentId,
  onCommentSave,
}: EditorBubbleMenuProps) {
  const [bubbleState, setBubbleState] = useState<BubbleState | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const commentSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const pointerInsideRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);
  const suppressBubbleRef = useRef(false);
  const lastSelectionRef = useRef({ from: 0, to: 0 });
  const linkOpenRef = useRef(false);
  const commentOpenRef = useRef(false);

  linkOpenRef.current = linkOpen;
  commentOpenRef.current = commentOpen;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const dismissBubble = useCallback(() => {
    suppressBubbleRef.current = true;
    setLinkOpen(false);
    setCommentOpen(false);
    commentSelectionRef.current = null;
    setBubbleState(null);
    clearHideTimer();

    const { to } = editor.state.selection;
    editor.chain().setTextSelection(to).blur().run();
  }, [clearHideTimer, editor]);

  const updatePosition = useCallback(() => {
    clearHideTimer();

    const { from, to } = editor.state.selection;
    if (from !== lastSelectionRef.current.from || to !== lastSelectionRef.current.to) {
      lastSelectionRef.current = { from, to };
    }

    const pinnedRange = commentSelectionRef.current ?? lastSelectionRef.current;
    const pinnedRect =
      pinnedRange.from < pinnedRange.to
        ? getRangeRect(editor, pinnedRange.from, pinnedRange.to)
        : null;

    if (linkOpenRef.current || commentOpenRef.current) {
      const rect = pinnedRect ?? getSelectionRect(editor);
      if (rect) setBubbleState(computeBubbleMenuPosition(rect));
      return;
    }

    if (suppressBubbleRef.current) {
      setBubbleState(null);
      return;
    }

    if (!shouldShowBubble(editor)) {
      if (!pointerInsideRef.current) {
        setBubbleState(null);
      }
      return;
    }

    const rect = getSelectionRect(editor);
    if (!rect) {
      if (!pointerInsideRef.current) {
        setBubbleState(null);
      }
      return;
    }

    setBubbleState(computeBubbleMenuPosition(rect));
  }, [clearHideTimer, editor]);

  const revealBubbleForSelection = useCallback(() => {
    const { from, to, empty } = editor.state.selection;
    if (empty || from >= to) return;

    lastSelectionRef.current = { from, to };
    suppressBubbleRef.current = false;
    window.requestAnimationFrame(() => updatePosition());
  }, [editor, updatePosition]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      if (
        pointerInsideRef.current ||
        linkOpenRef.current ||
        commentOpenRef.current
      ) {
        return;
      }
      setBubbleState(null);
    }, 120);
  }, [clearHideTimer]);

  useEffect(() => {
    suppressBubbleRef.current = true;
    setBubbleState(null);
    setLinkOpen(false);
    setCommentOpen(false);
    commentSelectionRef.current = null;

    const onChange = () => updatePosition();
    const onBlur = () => {
      window.setTimeout(() => {
        if (
          linkOpenRef.current ||
          commentOpenRef.current ||
          pointerInsideRef.current
        ) {
          return;
        }
        setBubbleState(null);
      }, 120);
    };

    const dom = editor.view.dom;
    dom.addEventListener("mouseup", revealBubbleForSelection);
    dom.addEventListener("keyup", revealBubbleForSelection);

    editor.on("selectionUpdate", onChange);
    editor.on("transaction", onChange);
    editor.on("blur", onBlur);
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);

    return () => {
      dom.removeEventListener("mouseup", revealBubbleForSelection);
      dom.removeEventListener("keyup", revealBubbleForSelection);
      editor.off("selectionUpdate", onChange);
      editor.off("transaction", onChange);
      editor.off("blur", onBlur);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
      clearHideTimer();
    };
  }, [clearHideTimer, editor, revealBubbleForSelection, updatePosition]);

  useEffect(() => {
    updatePosition();
  }, [commentOpen, linkOpen, updatePosition]);

  const handleMarkClick = useCallback(
    (mark: BubbleActiveMark) => {
      const chain = editor.chain().focus();
      switch (mark) {
        case "bold":
          chain.toggleBold().run();
          break;
        case "italic":
          chain.toggleItalic().run();
          break;
        case "bulletList":
          chain.toggleBulletList().run();
          break;
        case "orderedList":
          chain.toggleOrderedList().run();
          break;
        case "quote":
          chain.toggleBlockquote().run();
          break;
        case "heading":
          chain.toggleHeading({ level: 2 }).run();
          break;
        default:
          break;
      }
      dismissBubble();
    },
    [dismissBubble, editor],
  );

  const applyLink = (payload: {
    mode: LinkMode;
    value: string;
    label: string;
  }) => {
    const href =
      payload.mode === "internal" && payload.value.startsWith("doc:")
        ? `/app/editor?doc=${payload.value.slice(4)}`
        : payload.value;

    const range = commentSelectionRef.current ?? lastSelectionRef.current;
    if (range.from >= range.to) {
      dismissBubble();
      return;
    }

    const chain = editor.chain().focus().setTextSelection(range);
    if (editor.isActive("link")) {
      chain.extendMarkRange("link");
    }

    chain
      .setMark("link", {
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        linkKind: payload.mode,
        linkLabel: payload.label,
      })
      .run();

    dismissBubble();
  };

  const handleAsk = () => {
    const { from, to } = lastSelectionRef.current;
    const selectedText =
      from < to ? editor.state.doc.textBetween(from, to, " ").trim() : "";
    dismissBubble();
    onAsk?.(selectedText || undefined);
  };

  if (!bubbleState) return null;

  return (
    <div
      className={`editor-bubble-anchor editor-bubble-anchor--${bubbleState.placement}`}
      style={{
        position: "fixed",
        top: bubbleState.top,
        left: bubbleState.left,
        zIndex: 50,
      }}
      onMouseDown={(event) => {
        const target = event.target as HTMLElement;
        if (
          target.closest(
            "input, textarea, .link-popover, .comment-popover, .segmented-control, button",
          )
        ) {
          return;
        }
        event.preventDefault();
      }}
      onMouseEnter={() => {
        pointerInsideRef.current = true;
        clearHideTimer();
      }}
      onMouseLeave={() => {
        pointerInsideRef.current = false;
        scheduleHide();
      }}
    >
      <BubbleMenuChrome
        placement={bubbleState.placement}
        className="bubble-menu--anchored"
        activeMarks={getActiveMarks(editor)}
        linkOpen={linkOpen}
        onLinkToggle={() => {
          const { from, to } = lastSelectionRef.current;
          if (from < to) commentSelectionRef.current = { from, to };
          suppressBubbleRef.current = false;
          setLinkOpen((open) => !open);
        }}
        onLinkClose={() => setLinkOpen(false)}
        onMarkClick={handleMarkClick}
        onAsk={handleAsk}
        onLinkApply={applyLink}
        commentOpen={commentOpen}
        onCommentToggle={() => {
          const { from, to } = lastSelectionRef.current;
          if (from >= to) return;
          commentSelectionRef.current = { from, to };
          suppressBubbleRef.current = false;
          setCommentOpen((open) => !open);
        }}
        onCommentSave={(text) => {
          const range = commentSelectionRef.current ?? lastSelectionRef.current;
          if (range.from >= range.to) return;
          onCommentSave?.(text, range);
          dismissBubble();
        }}
        onCommentClose={dismissBubble}
        workspaceId={workspaceId}
        currentDocumentId={documentId}
      />
    </div>
  );
}
