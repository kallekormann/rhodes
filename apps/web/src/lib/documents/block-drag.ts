import type { Editor } from "@tiptap/react";

export const DROP_GAP_PX = 48;

export function isDropPlaceholder(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  return (
    element.classList.contains("editor-block-drop-slot") ||
    element.classList.contains("editor-block-drop-placeholder") ||
    (element.classList.contains("block-drop-zone") &&
      element.textContent === "Drop here")
  );
}

export function getTopLevelBlockElements(editor: Editor): HTMLElement[] {
  const root = editor.view.dom;
  return Array.from(root.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && !isDropPlaceholder(child),
  );
}

/** Remove any legacy in-DOM drop placeholders from earlier drag implementations. */
export function removeDropPlaceholder(editor: Editor) {
  const root = editor.view.dom;
  Array.from(
    root.querySelectorAll(
      ".editor-block-drop-slot, .editor-block-drop-placeholder, .block-drop-zone",
    ),
  ).forEach((node) => {
    if (
      node instanceof HTMLElement &&
      (node.classList.contains("editor-block-drop-slot") ||
        node.classList.contains("editor-block-drop-placeholder") ||
        (node.classList.contains("block-drop-zone") &&
          node.textContent === "Drop here" &&
          node.parentElement === root))
    ) {
      node.remove();
    }
  });
}

export function getTopLevelBlockCount(editor: Editor): number {
  return getTopLevelBlockElements(editor).length;
}

export function isNoOpDrop(fromIndex: number, toIndex: number): boolean {
  return toIndex === fromIndex || toIndex === fromIndex + 1;
}

export function moveTopLevelBlock(
  editor: Editor,
  fromIndex: number,
  toIndex: number,
): void {
  if (isNoOpDrop(fromIndex, toIndex)) return;

  const { state } = editor;
  const { doc } = state;

  if (fromIndex < 0 || fromIndex >= doc.childCount) return;
  if (toIndex < 0 || toIndex > doc.childCount) return;

  let fromPos = 0;
  for (let i = 0; i < fromIndex; i++) fromPos += doc.child(i).nodeSize;

  const node = doc.child(fromIndex);
  const tr = state.tr.delete(fromPos, fromPos + node.nodeSize);

  const mappedIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
  const mappedDoc = tr.doc;

  let insertPos = 0;
  if (mappedIndex >= mappedDoc.childCount) {
    insertPos = mappedDoc.content.size;
  } else {
    for (let i = 0; i < mappedIndex; i++) insertPos += mappedDoc.child(i).nodeSize;
  }

  tr.insert(insertPos, node);
  editor.view.dispatch(tr.scrollIntoView());
}

/** Matches ui-mock computeDropIndex — tests every block midpoint. */
export function computeBlockDropIndex(
  clientY: number,
  blockElements: HTMLElement[],
): number {
  for (let i = 0; i < blockElements.length; i++) {
    const rect = blockElements[i]!.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (clientY < mid) return i;
  }
  return blockElements.length;
}

export function findBlockIndexFromElement(
  editor: Editor,
  element: HTMLElement | null,
): number | null {
  if (!element) return null;
  const blocks = getTopLevelBlockElements(editor);
  const index = blocks.findIndex(
    (block) => block === element || block.contains(element),
  );
  return index === -1 ? null : index;
}

export function getBlockIndexForPos(editor: Editor, pos: number): number | null {
  const { doc } = editor.state;
  const safePos = Math.max(0, Math.min(pos, doc.content.size));
  let offset = 0;

  for (let i = 0; i < doc.childCount; i++) {
    const size = doc.child(i).nodeSize;
    if (safePos >= offset && safePos < offset + size) return i;
    offset += size;
  }

  return doc.childCount > 0 ? doc.childCount - 1 : null;
}

export function findBlockIndexAtClientY(
  editor: Editor,
  clientY: number,
): number | null {
  const blocks = getTopLevelBlockElements(editor);
  for (let i = 0; i < blocks.length; i++) {
    const rect = blocks[i]!.getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) return i;
  }
  return null;
}
