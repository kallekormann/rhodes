"use client";

import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BlockDragHandle } from "@/components/BlockDragHandle";
import {
  blockDropPluginKey,
  clearDropDecoration,
  createBlockDropPlugin,
  syncDropDecoration,
} from "@/lib/documents/block-drop-decoration";
import {
  computeBlockDropIndex,
  findBlockIndexAtClientY,
  findBlockIndexFromElement,
  getDocBlockIndexForDomIndex,
  getTopLevelBlockElements,
  isNoOpDrop,
  moveTopLevelBlock,
  removeDropPlaceholder,
} from "@/lib/documents/block-drag";
import "@/components/BlockDragHandle.css";
import "@/components/BlockDropZone.css";
import "./EditorBlockDragLayer.css";

type DragGhost = {
  top: number;
  left: number;
  width: number;
  height: number;
  html: string;
};

type EditorBlockDragLayerProps = {
  editor: Editor;
  containerRef: React.RefObject<HTMLElement | null>;
  onDragActiveChange?: (active: boolean) => void;
  onLayoutChange?: () => void;
  onBlockMoved?: () => void;
};

function clearDragLayout(blocks: HTMLElement[]) {
  blocks.forEach((block) => {
    block.classList.remove("tiptap-block--drag-source");
  });
}

function applyDragSourceState(blocks: HTMLElement[], dragIndex: number) {
  blocks.forEach((block, index) => {
    block.classList.toggle("tiptap-block--drag-source", index === dragIndex);
  });
}

function isPointInRect(
  x: number,
  y: number,
  rect: DOMRect,
  padding = 0,
): boolean {
  return (
    x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding
  );
}

export function EditorBlockDragLayer({
  editor,
  containerRef,
  onDragActiveChange,
  onLayoutChange,
  onBlockMoved,
}: EditorBlockDragLayerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [handleTop, setHandleTop] = useState(0);
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const dragPointerOffsetRef = useRef({ x: 0, y: 0 });
  const dragGhostMetaRef = useRef<{
    width: number;
    height: number;
    html: string;
  } | null>(null);
  const onLayoutChangeRef = useRef(onLayoutChange);
  const onDragActiveChangeRef = useRef(onDragActiveChange);
  const onBlockMovedRef = useRef(onBlockMoved);

  dragIndexRef.current = dragIndex;
  onLayoutChangeRef.current = onLayoutChange;
  onDragActiveChangeRef.current = onDragActiveChange;
  onBlockMovedRef.current = onBlockMoved;

  useEffect(() => {
    const plugin = createBlockDropPlugin();
    editor.registerPlugin(plugin);
    removeDropPlaceholder(editor);

    return () => {
      clearDropDecoration(editor);
      editor.unregisterPlugin(blockDropPluginKey);
      removeDropPlaceholder(editor);
    };
  }, [editor]);

  const syncHandlePosition = useCallback(
    (index: number | null) => {
      if (index === null || !containerRef.current) return;
      const blocks = getTopLevelBlockElements(editor);
      const block = blocks[index];
      const container = containerRef.current;
      if (!block || !container) return;

      const blockRect = block.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setHandleTop(blockRect.top - containerRect.top + 4);
    },
    [containerRef, editor],
  );

  const setHoverIndex = useCallback(
    (index: number | null) => {
      if (index === hoveredIndexRef.current) return;
      hoveredIndexRef.current = index;
      setHoveredIndex(index);
      syncHandlePosition(index);
    },
    [syncHandlePosition],
  );

  const updateGhostPosition = useCallback((clientX: number, clientY: number) => {
    const meta = dragGhostMetaRef.current;
    if (!meta) return;

    const offset = dragPointerOffsetRef.current;
    setDragGhost({
      top: clientY - offset.y,
      left: clientX - offset.x,
      width: meta.width,
      height: meta.height,
      html: meta.html,
    });
  }, []);

  const syncDragLayout = useCallback(
    (activeDragIndex: number, activeDropIndex: number) => {
      const blocks = getTopLevelBlockElements(editor);
      applyDragSourceState(blocks, activeDragIndex);
      syncDropDecoration(editor, activeDragIndex, activeDropIndex);
      onLayoutChangeRef.current?.();
    },
    [editor],
  );

  const beginDrag = useCallback(
    (index: number, clientX: number, clientY: number) => {
      const blocks = getTopLevelBlockElements(editor);
      const block = blocks[index];
      if (!block) return;

      const rect = block.getBoundingClientRect();
      dragPointerOffsetRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      dragGhostMetaRef.current = {
        width: rect.width,
        height: rect.height,
        html: block.innerHTML,
      };

      dragIndexRef.current = index;
      dropIndexRef.current = index;
      setDragIndex(index);
      updateGhostPosition(clientX, clientY);
      syncDragLayout(index, index);
    },
    [editor, syncDragLayout, updateGhostPosition],
  );

  const resetDragVisuals = useCallback(() => {
    clearDragLayout(getTopLevelBlockElements(editor));
    clearDropDecoration(editor);
    removeDropPlaceholder(editor);
    dragGhostMetaRef.current = null;
    setDragGhost(null);
    onLayoutChangeRef.current?.();
  }, [editor]);

  useEffect(() => {
    const purgeOrphans = () => {
      if (dragIndexRef.current !== null) return;
      clearDropDecoration(editor);
      removeDropPlaceholder(editor);
    };

    editor.on("update", purgeOrphans);
    return () => {
      editor.off("update", purgeOrphans);
    };
  }, [editor]);

  useEffect(() => {
    onDragActiveChangeRef.current?.(dragIndex !== null);
  }, [dragIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (event: MouseEvent) => {
      if (dragIndexRef.current !== null) return;

      const handle = handleRef.current;
      if (handle && isPointInRect(event.clientX, event.clientY, handle.getBoundingClientRect(), 6)) {
        return;
      }

      const proseMirror = editor.view.dom;
      const target = event.target;
      if (target instanceof Node && proseMirror.contains(target)) {
        const element =
          target instanceof HTMLElement ? target : target.parentElement;
        setHoverIndex(findBlockIndexFromElement(editor, element));
        return;
      }

      const blockIndex = findBlockIndexAtClientY(editor, event.clientY);
      if (blockIndex !== null) {
        setHoverIndex(blockIndex);
        return;
      }

      setHoverIndex(null);
    };

    container.addEventListener("mousemove", onMouseMove);
    return () => container.removeEventListener("mousemove", onMouseMove);
  }, [containerRef, editor, setHoverIndex]);

  useEffect(() => {
    if (dragIndex === null) return;

    const onMove = (event: MouseEvent) => {
      const blocks = getTopLevelBlockElements(editor);
      const activeDragIndex = dragIndexRef.current;
      if (activeDragIndex === null) return;

      const nextDropIndex = computeBlockDropIndex(event.clientY, blocks);
      dropIndexRef.current = nextDropIndex;
      updateGhostPosition(event.clientX, event.clientY);
      syncDragLayout(activeDragIndex, nextDropIndex);
    };

    const onUp = () => {
      const from = dragIndexRef.current;
      const to = dropIndexRef.current;

      try {
        if (from !== null && to !== null && !isNoOpDrop(from, to)) {
          const fromDoc = getDocBlockIndexForDomIndex(editor, from);
          const toDoc = getDocBlockIndexForDomIndex(editor, to) ?? to;
          if (fromDoc !== null) {
            moveTopLevelBlock(editor, fromDoc, toDoc);
            onBlockMovedRef.current?.();
          }
        }
      } finally {
        clearDropDecoration(editor);
        clearDragLayout(getTopLevelBlockElements(editor));
        resetDragVisuals();
        dragIndexRef.current = null;
        dropIndexRef.current = null;
        setDragIndex(null);
        setHoverIndex(null);
      }
    };

    syncDragLayout(dragIndex, dropIndexRef.current ?? dragIndex);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      clearDropDecoration(editor);
      clearDragLayout(getTopLevelBlockElements(editor));
    };
  }, [dragIndex, editor, resetDragVisuals, setHoverIndex, syncDragLayout, updateGhostPosition]);

  useEffect(() => {
    if (hoveredIndex === null) return;
    syncHandlePosition(hoveredIndex);
  }, [editor.state.doc, hoveredIndex, syncHandlePosition]);

  const activeIndex =
    hoveredIndex !== null || dragIndex !== null
      ? hoveredIndex ?? dragIndex
      : null;

  return (
    <>
      {dragGhost && (
        <div
          className="editor-block-drag-ghost"
          style={{
            top: dragGhost.top,
            left: dragGhost.left,
            width: dragGhost.width,
            minHeight: dragGhost.height,
          }}
          aria-hidden="true"
        >
          <div
            className="editor-block-drag-ghost__content tiptap-editor-body"
            dangerouslySetInnerHTML={{ __html: dragGhost.html }}
          />
        </div>
      )}

      <div className="editor-block-drag-layer" aria-hidden={activeIndex === null}>
        {activeIndex !== null && dragIndex === null && (
          <div
            ref={handleRef}
            className="editor-block-drag-layer__handle"
            style={{ top: handleTop }}
            onMouseEnter={() => {
              if (hoveredIndexRef.current !== null) {
                setHoveredIndex(hoveredIndexRef.current);
              }
            }}
          >
            <BlockDragHandle
              visible
              onMouseDown={(event) => {
                event.preventDefault();
                const index = hoveredIndexRef.current ?? activeIndex;
                if (index === null) return;
                beginDrag(index, event.clientX, event.clientY);
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
