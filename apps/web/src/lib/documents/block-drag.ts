import type { Editor } from "@tiptap/react";

export const DROP_GAP_PX = 48;

export type TopLevelBlockMatch = {
  node: import("@tiptap/pm/model").Node;
  index: number;
  pos: number;
};

/** Resolve the top-level block containing a document position. */
export function getTopLevelBlockAtPos(
  editor: Editor,
  pos: number,
): TopLevelBlockMatch | null {
  const { doc } = editor.state;
  if (doc.childCount === 0) return null;

  const safePos = Math.max(0, Math.min(pos, doc.content.size));
  let blockPos = 0;

  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const end = blockPos + node.nodeSize;
    if (safePos >= blockPos && safePos < end) {
      return { node, index: i, pos: blockPos };
    }
    blockPos = end;
  }

  let lastPos = 0;
  for (let i = 0; i < doc.childCount - 1; i++) {
    lastPos += doc.child(i).nodeSize;
  }

  const lastIndex = doc.childCount - 1;
  return {
    node: doc.child(lastIndex),
    index: lastIndex,
    pos: lastPos,
  };
}

export type EditorBlockAnchor = {
  docIndex: number;
  element: HTMLElement;
  pos: number;
};

/** Map each ProseMirror top-level node to its visible DOM block element. */
export function getEditorBlockAnchors(editor: Editor): EditorBlockAnchor[] {
  const { doc } = editor.state;
  const rootBlocks = getTopLevelBlockElements(editor);
  const anchors: EditorBlockAnchor[] = [];

  if (rootBlocks.length === doc.childCount) {
    let pos = 0;
    for (let docIndex = 0; docIndex < doc.childCount; docIndex += 1) {
      anchors.push({
        docIndex,
        element: rootBlocks[docIndex]!,
        pos,
      });
      pos += doc.child(docIndex).nodeSize;
    }
    return anchors;
  }

  for (const element of rootBlocks) {
    try {
      const textPos = editor.view.posAtDOM(element, 0);
      const match = getTopLevelBlockAtPos(editor, textPos);
      if (!match) continue;
      anchors.push({ docIndex: match.index, element, pos: match.pos });
    } catch {
      // Ignore blocks that cannot be mapped back to a document position.
    }
  }

  return anchors;
}

/** DOM element for a top-level block via ProseMirror's node mapping. */
export function getBlockDomForMatch(
  editor: Editor,
  match: TopLevelBlockMatch,
): HTMLElement | null {
  const root = editor.view.dom;

  const toRootBlock = (node: Node | null): HTMLElement | null => {
    if (!node) return null;

    let element: HTMLElement | null =
      node instanceof HTMLElement
        ? node
        : node instanceof Text
          ? node.parentElement
          : null;

    while (element && element.parentElement !== root) {
      element = element.parentElement;
    }

    return element;
  };

  for (const probe of [match.pos, match.pos + 1]) {
    const element = toRootBlock(editor.view.nodeDOM(probe));
    if (element) return element;
  }

  return null;
}

export function getBlockAnchorForPos(
  editor: Editor,
  textPos: number,
): EditorBlockAnchor | null {
  const match = getTopLevelBlockAtPos(editor, textPos);
  if (!match) return null;

  const { doc } = editor.state;
  const rootBlocks = getTopLevelBlockElements(editor);

  if (rootBlocks.length === doc.childCount && rootBlocks[match.index]) {
    return {
      docIndex: match.index,
      element: rootBlocks[match.index]!,
      pos: match.pos,
    };
  }

  return (
    getEditorBlockAnchors(editor).find((anchor) => anchor.docIndex === match.index) ??
    null
  );
}

export function getDomIndexForAnchor(
  editor: Editor,
  anchor: EditorBlockAnchor,
): number {
  return getTopLevelBlockElements(editor).indexOf(anchor.element);
}

/** DOM block element containing a document position (direct child of ProseMirror root). */
export function getTopLevelBlockDomFromPos(
  editor: Editor,
  pos: number,
): HTMLElement | null {
  const match = getTopLevelBlockAtPos(editor, pos);
  if (!match) return null;
  return getBlockDomForMatch(editor, match);
}

/** Index in getTopLevelBlockElements() for a document position. */
export function getTopLevelBlockIndexFromPos(
  editor: Editor,
  pos: number,
): number | null {
  const anchor = getBlockAnchorForPos(editor, pos);
  if (!anchor) return null;

  const index = getDomIndexForAnchor(editor, anchor);
  return index === -1 ? null : index;
}

/** DOM element for a top-level block, via ProseMirror's node mapping. */
export function getTopLevelBlockDom(
  editor: Editor,
  block: TopLevelBlockMatch,
): HTMLElement | null {
  return (
    getTopLevelBlockDomFromPos(editor, block.pos + 1) ??
    getTopLevelBlockDomFromPos(editor, block.pos)
  );
}

export function getCommentBlockGroupKey(
  editor: Editor,
  comment: { from: number; blockId: string; blockIndex: number },
): string {
  if (comment.blockId) return `id:${comment.blockId}`;

  const match = getTopLevelBlockAtPos(editor, comment.from);
  if (match) {
    const nodeBlockId = match.node.attrs.blockId;
    if (typeof nodeBlockId === "string" && nodeBlockId.length > 0) {
      return `id:${nodeBlockId}`;
    }
    return `doc:${match.index}`;
  }

  return `idx:${comment.blockIndex}`;
}

export function getBlockElementAtIndex(
  editor: Editor,
  blockIndex: number,
): HTMLElement | null {
  return getTopLevelBlockElements(editor)[blockIndex] ?? null;
}

export function getBlockDomForComment(
  editor: Editor,
  comment: { from: number; blockId: string; blockIndex: number },
): HTMLElement | null {
  if (comment.blockId) {
    const byId = getBlockElementByBlockId(editor, comment.blockId);
    if (byId) return byId;
  }

  const match = getTopLevelBlockAtPos(editor, comment.from);
  if (match) return getBlockDomForMatch(editor, match);

  return getBlockElementAtIndex(editor, comment.blockIndex);
}

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

export function getTopLevelBlockInsertPos(
  doc: import("@tiptap/pm/model").Node,
  blockIndex: number,
): number {
  if (blockIndex >= doc.childCount) return doc.content.size;

  let pos = 0;
  for (let i = 0; i < blockIndex; i += 1) {
    pos += doc.child(i).nodeSize;
  }
  return pos;
}

export function getDocBlockIndexForDomIndex(
  editor: Editor,
  domIndex: number,
): number | null {
  const element = getTopLevelBlockElements(editor)[domIndex];
  if (!element) return null;

  if (getTopLevelBlockElements(editor).length === editor.state.doc.childCount) {
    return domIndex;
  }

  try {
    const pos = editor.view.posAtDOM(element, 0);
    return editor.state.doc.resolve(pos).index(0);
  } catch {
    return domIndex;
  }
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

  const fromPos = getTopLevelBlockInsertPos(doc, fromIndex);
  const node = doc.child(fromIndex);
  const deleteTo = fromPos + node.nodeSize;

  if (deleteTo > doc.content.size) return;

  const tr = state.tr.delete(fromPos, deleteTo);

  const mappedIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
  const mappedDoc = tr.doc;
  const insertPos = getTopLevelBlockInsertPos(mappedDoc, mappedIndex);

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

export function getBlockIdForPos(editor: Editor, pos: number): string | null {
  const match = getTopLevelBlockAtPos(editor, pos);
  if (match) {
    const nodeBlockId = match.node.attrs.blockId;
    if (typeof nodeBlockId === "string" && nodeBlockId.length > 0) {
      return nodeBlockId;
    }
  }

  if (!match) return null;

  const domBlockId = getBlockDomForMatch(editor, match)?.getAttribute(
    "data-block-id",
  );
  return domBlockId && domBlockId.length > 0 ? domBlockId : null;
}

export function getBlockElementByBlockId(
  editor: Editor,
  blockId: string,
): HTMLElement | null {
  for (const block of getTopLevelBlockElements(editor)) {
    if (block.getAttribute("data-block-id") === blockId) return block;
  }
  return null;
}

export function getBlockIndexForPos(editor: Editor, pos: number): number | null {
  return getTopLevelBlockIndexFromPos(editor, pos);
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
