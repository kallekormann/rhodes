"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommentMarker } from "@/components/CommentMarker";
import { CommentThread } from "@/components/CommentNoteBubble";
import {
  getBlockIndexForPos,
  getTopLevelBlockElements,
} from "@/lib/documents/block-drag";
import type { StoredDocumentComment } from "@/lib/documents/comments";
import "@/components/CommentMarker.css";
import "@/components/CommentNoteBubble.css";
import "./EditorCommentsOverlay.css";

type BlockCommentGroup = {
  blockIndex: number;
  comments: StoredDocumentComment[];
  top: number;
  left: number;
};

type EditorCommentsOverlayProps = {
  editor: Editor;
  containerRef: React.RefObject<HTMLElement | null>;
  comments: StoredDocumentComment[];
  isDragging?: boolean;
  layoutTick?: number;
  onEmphasizedCommentChange?: (commentId: string | null) => void;
};

function toDisplayComment(comment: StoredDocumentComment) {
  const created = new Date(comment.createdAt);
  const createdLabel = Number.isNaN(created.getTime())
    ? comment.createdAt
    : created.toLocaleString();

  return {
    id: comment.id,
    blockId: comment.id,
    start: comment.from,
    end: comment.to,
    anchorText: comment.anchorText,
    text: comment.text,
    author: comment.author,
    createdAt: createdLabel,
  };
}

export function EditorCommentsOverlay({
  editor,
  containerRef,
  comments,
  isDragging = false,
  layoutTick = 0,
  onEmphasizedCommentChange,
}: EditorCommentsOverlayProps) {
  const [openBlockIndex, setOpenBlockIndex] = useState<number | null>(null);
  const [hoverCommentId, setHoverCommentId] = useState<string | null>(null);
  const [groups, setGroups] = useState<BlockCommentGroup[]>([]);
  const onEmphasizedCommentChangeRef = useRef(onEmphasizedCommentChange);

  onEmphasizedCommentChangeRef.current = onEmphasizedCommentChange;

  const grouped = useMemo(() => {
    const map = new Map<number, StoredDocumentComment[]>();
    for (const comment of comments) {
      const blockIndex = getBlockIndexForPos(editor, comment.from);
      if (blockIndex === null) continue;
      const list = map.get(blockIndex) ?? [];
      list.push(comment);
      map.set(blockIndex, list);
    }
    return map;
  }, [comments, editor]);

  const syncMarkers = useCallback(() => {
    const container = containerRef.current;
    if (!container || comments.length === 0) {
      setGroups([]);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const blocks = getTopLevelBlockElements(editor);
    const next: BlockCommentGroup[] = [];

    for (const [blockIndex, blockComments] of grouped.entries()) {
      const block = blocks[blockIndex];
      if (!block) continue;

      const blockRect = block.getBoundingClientRect();
      next.push({
        blockIndex,
        comments: blockComments,
        top: blockRect.top - containerRect.top + 4,
        left: containerRect.width - 4,
      });
    }

    setGroups(next);
  }, [comments.length, containerRef, editor, grouped, layoutTick]);

  useEffect(() => {
    syncMarkers();

    const onChange = () => syncMarkers();
    editor.on("transaction", onChange);
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);

    return () => {
      editor.off("transaction", onChange);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, [editor, syncMarkers]);

  useEffect(() => {
    if (!isDragging) return;

    let frame = 0;
    const tick = () => {
      syncMarkers();
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, [isDragging, syncMarkers]);

  useEffect(() => {
    onEmphasizedCommentChangeRef.current?.(hoverCommentId);
  }, [hoverCommentId]);

  const openGroup = groups.find((group) => group.blockIndex === openBlockIndex);

  if (comments.length === 0) return null;

  return (
    <div className="editor-comments-overlay" aria-label="Document comments">
      {groups.map((group) => (
        <div
          key={group.blockIndex}
          className="editor-comments-overlay__marker"
          style={{ top: group.top, left: group.left }}
        >
          <CommentMarker
            count={group.comments.length}
            active={openBlockIndex === group.blockIndex}
            onClick={() =>
              setOpenBlockIndex((current) => {
                const next = current === group.blockIndex ? null : group.blockIndex;
                if (next === null) setHoverCommentId(null);
                return next;
              })
            }
          />
        </div>
      ))}

      {openGroup && (
        <div
          className="editor-comments-overlay__thread"
          style={{ top: openGroup.top, left: openGroup.left + 36 }}
          onMouseLeave={() => setHoverCommentId(null)}
        >
          <CommentThread
            className="comment-thread--overlay"
            comments={openGroup.comments.map(toDisplayComment)}
            hoverCommentId={hoverCommentId}
            onCommentHover={setHoverCommentId}
          />
        </div>
      )}
    </div>
  );
}
