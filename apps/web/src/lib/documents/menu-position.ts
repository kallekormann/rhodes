import type { Editor } from "@tiptap/react";

export type VerticalPlacement = "above" | "below";

const VIEWPORT_PADDING = 8;
const SLASH_MENU_HEIGHT = 340;
const SLASH_MENU_WIDTH = 280;
const BUBBLE_MENU_HEIGHT = 56;
const BUBBLE_MENU_WIDTH = 420;
const BUBBLE_GAP = 10;

export function computeSlashPlacement(caretRect: DOMRect): VerticalPlacement {
  const spaceBelow = window.innerHeight - caretRect.bottom;
  return spaceBelow >= SLASH_MENU_HEIGHT ? "below" : "above";
}

export function computeSlashMenuPosition(
  caretRect: DOMRect,
  placement: VerticalPlacement,
): { top: number; left: number; placement: VerticalPlacement } {
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, caretRect.left),
    window.innerWidth - SLASH_MENU_WIDTH - VIEWPORT_PADDING,
  );

  if (placement === "below") {
    return {
      placement,
      top: caretRect.bottom + 8,
      left,
    };
  }

  return {
    placement,
    top: caretRect.top - 8,
    left,
  };
}

export function clampActiveIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return Math.min(Math.max(index, 0), itemCount - 1);
}

export function getRangeRect(
  editor: Editor,
  from: number,
  to: number,
): DOMRect | null {
  if (from >= to) return null;

  const view = editor.view;
  const docSize = editor.state.doc.content.size;
  const safeFrom = Math.max(0, Math.min(from, docSize));
  const safeTo = Math.max(safeFrom, Math.min(to, docSize));
  if (safeFrom >= safeTo) return null;

  try {
    const start = view.coordsAtPos(safeFrom);
    const end = view.coordsAtPos(safeTo);
    const left = Math.min(start.left, end.left);
    const right = Math.max(start.right, end.right);
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);
    return new DOMRect(left, top, right - left, bottom - top);
  } catch {
    return null;
  }
}

export function getSelectionRect(editor: Editor): DOMRect | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  return getRangeRect(editor, from, to);
}

export function computeBubbleMenuPosition(selectionRect: DOMRect): {
  top: number;
  left: number;
  placement: VerticalPlacement;
} {
  const spaceAbove = selectionRect.top - VIEWPORT_PADDING;
  const spaceBelow =
    window.innerHeight - selectionRect.bottom - VIEWPORT_PADDING;

  let placement: VerticalPlacement;
  if (spaceAbove >= BUBBLE_MENU_HEIGHT + BUBBLE_GAP) {
    placement = "above";
  } else if (spaceBelow >= BUBBLE_MENU_HEIGHT + BUBBLE_GAP) {
    placement = "below";
  } else {
    placement = spaceBelow > spaceAbove ? "below" : "above";
  }

  const centerX = selectionRect.left + selectionRect.width / 2;
  const halfWidth = BUBBLE_MENU_WIDTH / 2;
  const left = Math.min(
    Math.max(VIEWPORT_PADDING + halfWidth, centerX),
    window.innerWidth - VIEWPORT_PADDING - halfWidth,
  );

  const top =
    placement === "above"
      ? selectionRect.top - BUBBLE_GAP
      : selectionRect.bottom + BUBBLE_GAP;

  return { top, left, placement };
}
