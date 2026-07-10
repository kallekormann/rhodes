import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { EditorBlock, EditorComment, TableBlock } from "../data/editorTypes";
import { createTableCells, initialEditorComments } from "../data/editorTypes";
import { BlockDragHandle } from "./BlockDragHandle";
import { BlockDropZone } from "./BlockDropZone";
import { BubbleMenu, type BubbleMenuPlacement } from "./BubbleMenu";
import { CommentMarker } from "./CommentMarker";
import { CommentThread } from "./CommentNoteBubble";
import { EditorTable } from "./EditorTable";
import {
  computeDropIndex,
  reorderBlocks,
} from "./editorBodyUtils";
import { renderCommentHighlights } from "./renderCommentHighlights";
import {
  filterSlashItems,
  getCaretClientRect,
  getSlashContext,
  placeCaret,
  removeSlashTrigger,
} from "./editorSlash";
import { SlashMenu, type SlashMenuItem } from "./SlashMenu";
import { TableInsertModal } from "./TableInsertModal";
import "./BlockDragHandle.css";
import "./BlockDropZone.css";
import "./CommentMarker.css";
import "./CommentNoteBubble.css";
import "./EditorBody.css";
import "./EditorTable.css";
import "./SlashMenu.css";

type SlashState = {
  blockId: string;
  query: string;
  activeIndex: number;
  placement: BubbleMenuPlacement;
  top: number;
  left: number;
};

type EditorBodyProps = {
  showBubble: boolean;
  setShowBubble: (show: boolean) => void;
  bubblePlacement: BubbleMenuPlacement;
  setBubblePlacement: (placement: BubbleMenuPlacement) => void;
  onAsk: () => void;
};

let blockIdCounter = 100;
const nextBlockId = () => `block-${blockIdCounter++}`;

const initialBlocks: EditorBlock[] = [
  { id: "h2-1", kind: "h2", content: "Objective and scope" },
  {
    id: "p-1",
    kind: "text",
    content:
      "This quarter we align product experiments with ARR growth targets. The spec should connect activation metrics from recent experiments with the frameworks in our library.",
  },
  { id: "p-2", kind: "text", content: "SELECTION_BLOCK" },
  { id: "h2-2", kind: "h2", content: "Activation metrics" },
  {
    id: "p-3",
    kind: "text",
    content:
      "Onboarding completion, time-to-value, and weekly active usage are the primary signals we track across experiments. Each hypothesis should map to at least one measurable change in these metrics within a single product cycle.",
  },
  {
    id: "p-4",
    kind: "text",
    content:
      "Reference materials in the library — especially growth frameworks and prior experiment write-ups — should inform which levers we pull first.",
  },
  { id: "p-5", kind: "text", content: "" },
];

type PendingTableInsert = { blockId: string; before: string; after: string };

export function EditorBody({
  showBubble,
  setShowBubble,
  bubblePlacement,
  setBubblePlacement,
  onAsk,
}: EditorBodyProps) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(initialBlocks);
  const [comments, setComments] = useState<EditorComment[]>(initialEditorComments);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [openCommentBlockId, setOpenCommentBlockId] = useState<string | null>(null);
  const [hoverCommentBlockId, setHoverCommentBlockId] = useState<string | null>(null);
  const [hoverCommentId, setHoverCommentId] = useState<string | null>(null);
  const [commentPopoverOpen, setCommentPopoverOpen] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [pendingTable, setPendingTable] = useState<PendingTableInsert | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Record<string, HTMLElement | null>>({});
  const wrapperRefs = useRef<Record<string, HTMLElement | null>>({});
  const selectionRef = useRef<HTMLButtonElement>(null);
  const focusBlockIdRef = useRef<string | null>(null);

  const blockComments = useCallback(
    (blockId: string) => comments.filter((comment) => comment.blockId === blockId),
    [comments],
  );

  const syncSlashFromElement = useCallback((blockId: string, element: HTMLElement) => {
    const ctx = getSlashContext(element);
    const container = contentRef.current;
    const caret = getCaretClientRect();

    if (!ctx || !container || !caret) {
      setSlash(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const spaceBelow = window.innerHeight - caret.bottom;
    const placement: BubbleMenuPlacement = spaceBelow > 340 ? "below" : "above";
    const top =
      placement === "below"
        ? caret.bottom - containerRect.top + 8
        : caret.top - containerRect.top - 8;

    setSlash((prev) => ({
      blockId,
      query: ctx.query,
      activeIndex:
        prev?.blockId === blockId && prev.query === ctx.query ? prev.activeIndex : 0,
      placement,
      top,
      left: Math.max(0, caret.left - containerRect.left),
    }));
  }, []);

  const insertTable = useCallback((rows: number, cols: number, pending: PendingTableInsert) => {
    const tableId = nextBlockId();
    const focusId = nextBlockId();
    const tableBlock: TableBlock = {
      id: tableId,
      kind: "table",
      rows,
      cols,
      cells: createTableCells(rows, cols),
    };

    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === pending.blockId);
      if (index === -1) return prev;

      const head = prev.slice(0, index);
      const tail = prev.slice(index + 1);
      const updatedCurrent = {
        id: pending.blockId,
        kind: "text" as const,
        content: `${pending.before}${pending.after}`.trimEnd(),
      };

      return [...head, updatedCurrent, tableBlock, { id: focusId, kind: "text", content: "" }, ...tail];
    });

    focusBlockIdRef.current = focusId;
  }, []);

  const executeSlash = useCallback((blockId: string, item: SlashMenuItem) => {
    const element = blockRefs.current[blockId];
    const ctx = element ? getSlashContext(element) : null;
    if (!element || !ctx) return;

    const text = element.textContent ?? "";
    const before = text.slice(0, ctx.slashStart);
    const after = text.slice(ctx.cursorOffset);

    if (item.id === "table") {
      setPendingTable({ blockId, before, after });
      setTableModalOpen(true);
      setSlash(null);
      return;
    }

    const focusId = nextBlockId();

    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === blockId);
      if (index === -1) return prev;

      const head = prev.slice(0, index);
      const tail = prev.slice(index + 1);
      const updatedCurrent = {
        id: blockId,
        kind: "text" as const,
        content: `${before}${after}`.trimEnd(),
      };

      const inserts: EditorBlock[] = [];

      if (item.id === "paragraph") {
        inserts.push({ id: focusId, kind: "text", content: "" });
      } else if (item.id === "divider") {
        inserts.push({ id: nextBlockId(), kind: "divider" });
        inserts.push({ id: focusId, kind: "text", content: "" });
      } else if (item.id === "image") {
        inserts.push({ id: nextBlockId(), kind: "image" });
        inserts.push({ id: focusId, kind: "text", content: "" });
      }

      return [...head, updatedCurrent, ...inserts, ...tail];
    });

    setSlash(null);
    focusBlockIdRef.current = focusId;
  }, []);

  useEffect(() => {
    const focusId = focusBlockIdRef.current;
    if (!focusId) return;
    const target = blockRefs.current[focusId];
    if (!target) return;
    target.focus();
    placeCaret(target, 0);
    focusBlockIdRef.current = null;
  }, [blocks]);

  useEffect(() => {
    if (!slash) return;
    setSlash((prev) => {
      if (!prev) return prev;
      const filtered = filterSlashItems(prev.query);
      const nextIndex = Math.min(prev.activeIndex, Math.max(filtered.length - 1, 0));
      return nextIndex === prev.activeIndex ? prev : { ...prev, activeIndex: nextIndex };
    });
  }, [slash?.query]);

  useEffect(() => {
    if (!dragBlockId) return;

    const onMove = (event: MouseEvent) => {
      const index = computeDropIndex(
        event.clientY,
        blocks.map((block) => block.id),
        wrapperRefs.current,
      );
      setDropIndex(index);
    };

    const onUp = () => {
      if (dragBlockId && dropIndex !== null) {
        setBlocks((prev) => reorderBlocks(prev, dragBlockId, dropIndex));
      }
      setDragBlockId(null);
      setDropIndex(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragBlockId, dropIndex, blocks]);

  const handleTextInput = (blockId: string, element: HTMLElement) => {
    const content = element.textContent ?? "";
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId && block.kind === "text" ? { ...block, content } : block,
      ),
    );
    syncSlashFromElement(blockId, element);
  };

  const handleTextKeyDown = (blockId: string, event: React.KeyboardEvent<HTMLElement>) => {
    if (!slash || slash.blockId !== blockId) {
      if (event.key === "/") {
        requestAnimationFrame(() => {
          const element = blockRefs.current[blockId];
          if (element) syncSlashFromElement(blockId, element);
        });
      }
      return;
    }

    const filtered = filterSlashItems(slash.query);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSlash((prev) =>
        prev
          ? {
              ...prev,
              activeIndex: Math.min(prev.activeIndex + 1, Math.max(filtered.length - 1, 0)),
            }
          : prev,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSlash((prev) =>
        prev ? { ...prev, activeIndex: Math.max(prev.activeIndex - 1, 0) } : prev,
      );
      return;
    }

    if (event.key === "Enter" && filtered.length > 0) {
      event.preventDefault();
      const item = filtered[slash.activeIndex];
      if (item) executeSlash(blockId, item);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      const element = blockRefs.current[blockId];
      const ctx = element ? getSlashContext(element) : null;
      if (element && ctx) removeSlashTrigger(element, ctx);
      setSlash(null);
      return;
    }

    if (event.key === " ") {
      setSlash(null);
    }
  };

  const handleSelectionClick = () => {
    if (selectionRef.current && contentRef.current) {
      const rect = selectionRef.current.getBoundingClientRect();
      const containerRect = contentRef.current.getBoundingClientRect();
      const spaceAbove = rect.top - containerRect.top;
      setBubblePlacement(spaceAbove > 72 ? "above" : "below");
    }
    setShowBubble(!showBubble);
    setCommentPopoverOpen(false);
  };

  const handleCommentSave = (text: string) => {
    setComments((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        blockId: "p-2",
        start: 0,
        end: 24,
        anchorText: "align with international",
        text,
        author: "Kalle",
        createdAt: "Just now",
      },
    ]);
    setCommentPopoverOpen(false);
    setShowBubble(false);
    setOpenCommentBlockId("p-2");
  };

  const renderTextParagraph = (
    block: Extract<EditorBlock, { kind: "text" }>,
    options?: { placeholder?: string },
  ) => {
    const commentsOnBlock = blockComments(block.id);
    const markerHovered = hoverCommentBlockId === block.id;
    const threadOpen = openCommentBlockId === block.id;
    const showHighlights = markerHovered || threadOpen;
    const hasComments = commentsOnBlock.length > 0;

    if (hasComments) {
      return (
        <p className="editor-body__text editor-body__text--static">
          {showHighlights
            ? renderCommentHighlights(block.content, commentsOnBlock, hoverCommentId)
            : block.content}
        </p>
      );
    }

    return (
      <p
        ref={(el) => {
          blockRefs.current[block.id] = el;
          if (el && document.activeElement !== el && el.textContent !== block.content) {
            el.textContent = block.content;
          }
        }}
        className="editor-body__text"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={options?.placeholder}
        onInput={(e) => handleTextInput(block.id, e.currentTarget)}
        onKeyDown={(e) => handleTextKeyDown(block.id, e)}
        onBlur={() => {
          if (slash?.blockId === block.id) {
            window.setTimeout(() => setSlash(null), 120);
          }
        }}
      />
    );
  };

  const renderBlockContent = (block: EditorBlock): ReactNode => {
    if (block.kind === "h2") {
      return (
        <h2
          className="editor-body__h2"
          ref={(el) => {
            blockRefs.current[block.id] = el;
          }}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) =>
            setBlocks((prev) =>
              prev.map((item) =>
                item.id === block.id && item.kind === "h2"
                  ? { ...item, content: e.currentTarget.textContent ?? "" }
                  : item,
              ),
            )
          }
        >
          {block.content}
        </h2>
      );
    }

    if (block.kind === "divider") {
      return <hr className="editor-body__divider" />;
    }

    if (block.kind === "table") {
      return (
        <EditorTable
          block={block}
          onChange={(next) =>
            setBlocks((prev) => prev.map((item) => (item.id === block.id ? next : item)))
          }
        />
      );
    }

    if (block.kind === "image") {
      return (
        <div className="editor-body__image" contentEditable={false}>
          <div className="editor-body__image-placeholder">Image — drop or upload</div>
        </div>
      );
    }

    if (block.content === "SELECTION_BLOCK") {
      const commentsOnBlock = blockComments("p-2");
      const markerHovered = hoverCommentBlockId === "p-2";
      const threadOpen = openCommentBlockId === "p-2";
      const showSelectionHighlight = commentsOnBlock.length > 0 && (markerHovered || threadOpen);
      const selectionEmphasized =
        Boolean(hoverCommentId) && commentsOnBlock.some((c) => c.id === hoverCommentId);

      return (
        <p className="editor-body__text">
          Key hypothesis: improving onboarding completion by 12% will compound into measurable
          revenue impact within two cycles.{" "}
          <span className="editor-body__selection-wrap">
            <button
              type="button"
              ref={selectionRef}
              className={`editor-body__selection ${showSelectionHighlight ? "editor-body__selection--comment" : ""} ${selectionEmphasized ? "editor-body__selection--comment-active" : ""}`}
              onClick={handleSelectionClick}
            >
              align with international
            </button>
            {showBubble && (
              <BubbleMenu
                placement={bubblePlacement}
                activeMarks={["bold"]}
                onAsk={onAsk}
                onLinkApply={() => setShowBubble(false)}
                commentOpen={commentPopoverOpen}
                onCommentToggle={() => setCommentPopoverOpen((open) => !open)}
                onCommentSave={handleCommentSave}
              />
            )}
          </span>{" "}
          expansion plans discussed in Q2.
        </p>
      );
    }

    return renderTextParagraph(block, {
      placeholder: block.content ? undefined : "Type / for blocks…",
    });
  };

  const filteredSlash = slash ? filterSlashItems(slash.query) : [];

  return (
    <div className="editor-body" ref={contentRef}>
      {blocks.map((block, index) => {
        const commentsOnBlock = blockComments(block.id);
        const isDragging = dragBlockId === block.id;
        const isHovered = hoveredBlockId === block.id;
        const showHandle = isHovered || isDragging;
        const showDropBefore = dragBlockId !== null && dropIndex === index && dragBlockId !== block.id;

        return (
          <div key={block.id} className="editor-body__block">
            {showDropBefore && (
              <div className="editor-body__drop">
                <BlockDropZone />
              </div>
            )}
            <div
              ref={(el) => {
                wrapperRefs.current[block.id] = el;
              }}
              className={`editor-body__row ${isDragging ? "editor-body__row--dragging" : ""}`}
              onMouseEnter={() => setHoveredBlockId(block.id)}
              onMouseLeave={() => setHoveredBlockId((current) => (current === block.id ? null : current))}
            >
              <div className="editor-body__gutter editor-body__gutter--left">
                <BlockDragHandle
                  visible={showHandle}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setDragBlockId(block.id);
                    setDropIndex(index);
                  }}
                />
              </div>
              <div className="editor-body__main">{renderBlockContent(block)}</div>
              <div
                className="editor-body__gutter editor-body__gutter--right"
                onMouseEnter={() => {
                  if (commentsOnBlock.length > 0) setHoverCommentBlockId(block.id);
                }}
                onMouseLeave={() => {
                  setHoverCommentBlockId((current) => (current === block.id ? null : current));
                  if (openCommentBlockId !== block.id) setHoverCommentId(null);
                }}
              >
                {commentsOnBlock.length > 0 && (
                  <div className="editor-body__comment-rail">
                    <CommentMarker
                      count={commentsOnBlock.length}
                      active={openCommentBlockId === block.id}
                      onClick={() =>
                        setOpenCommentBlockId((current) => {
                          const next = current === block.id ? null : block.id;
                          if (next === null) setHoverCommentId(null);
                          return next;
                        })
                      }
                    />
                    {openCommentBlockId === block.id && (
                      <CommentThread
                        className="comment-thread--aside"
                        comments={commentsOnBlock}
                        hoverCommentId={hoverCommentId}
                        onCommentHover={setHoverCommentId}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {dragBlockId && dropIndex === blocks.length && (
        <div className="editor-body__drop">
          <BlockDropZone />
        </div>
      )}

      {slash && (
        <div
          className={`editor-body__slash-anchor editor-body__slash-anchor--${slash.placement}`}
          style={{ top: slash.top, left: slash.left }}
        >
          <SlashMenu
            query={slash.query}
            activeIndex={slash.activeIndex}
            placement={slash.placement}
            items={filteredSlash}
            onItemClick={(item) => executeSlash(slash.blockId, item)}
          />
        </div>
      )}

      <TableInsertModal
        open={tableModalOpen}
        onClose={() => {
          setTableModalOpen(false);
          setPendingTable(null);
        }}
        onInsert={(rows, cols) => {
          if (pendingTable) insertTable(rows, cols, pendingTable);
          setPendingTable(null);
        }}
      />
    </div>
  );
}
