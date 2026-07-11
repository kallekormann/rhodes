import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { getTopLevelBlockAtPos, type TopLevelBlockMatch } from "@/lib/documents/block-drag";
import { createBlockId } from "@/lib/documents/ids";

export const BLOCK_ID_TRANSACTION_META = "blockIdAssign";

const TOP_LEVEL_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "horizontalRule",
  "codeBlock",
  "bulletList",
  "orderedList",
  "table",
  "image",
  "citation",
]);

type BlockIdUpdate = {
  pos: number;
  type: ProseMirrorNode["type"];
  blockId: string;
};

function hasBlockId(node: ProseMirrorNode): boolean {
  const blockId = node.attrs.blockId;
  return typeof blockId === "string" && blockId.length > 0;
}

function readBlockId(node: ProseMirrorNode): string | null {
  const blockId = node.attrs.blockId;
  return typeof blockId === "string" && blockId.length > 0 ? blockId : null;
}

/** Collect top-level blocks missing a block id. */
export function collectMissingTopLevelBlockIds(
  doc: ProseMirrorNode,
): BlockIdUpdate[] {
  const updates: BlockIdUpdate[] = [];
  let pos = 1;

  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);

    if (TOP_LEVEL_BLOCK_TYPES.has(node.type.name) && !hasBlockId(node)) {
      updates.push({ pos, type: node.type, blockId: createBlockId() });
    }

    pos += node.nodeSize;
  }

  return updates;
}

function trySetBlockIdOnMatch(
  editor: Editor,
  match: TopLevelBlockMatch,
  blockId: string,
): boolean {
  try {
    const node = editor.state.doc.nodeAt(match.pos);
    if (!node || node.isText) return false;

    const tr = editor.state.tr.setNodeMarkup(match.pos, node.type, {
      ...node.attrs,
      blockId,
    });
    tr.setMeta(BLOCK_ID_TRANSACTION_META, true);
    editor.view.dispatch(tr);
    return true;
  } catch {
    return false;
  }
}

function applyBlockIdUpdate(
  editor: Editor,
  tr: Transaction,
  update: BlockIdUpdate,
): Transaction | null {
  const $pos = tr.doc.resolve(update.pos);
  const node = $pos.nodeAfter;
  if (!node || node.isText || node.type !== update.type || hasBlockId(node)) {
    return null;
  }

  const at = tr.doc.nodeAt(update.pos);
  if (!at || at.isText) return null;

  try {
    return tr.setNodeMarkup(update.pos, update.type, {
      ...node.attrs,
      blockId: update.blockId,
    });
  } catch {
    return null;
  }
}

export function buildBlockIdTransaction(
  editor: Editor,
  updates: BlockIdUpdate[],
  tr: Transaction,
): Transaction | null {
  if (updates.length === 0) return null;

  let next = tr;
  let changed = false;

  for (const update of [...updates].sort((a, b) => b.pos - a.pos)) {
    const applied = applyBlockIdUpdate(editor, next, update);
    if (!applied) continue;
    next = applied;
    changed = true;
  }

  if (!changed) return null;

  next.setMeta(BLOCK_ID_TRANSACTION_META, true);
  return next;
}

export function ensureEditorBlockIds(editor: Editor): void {
  const updates = collectMissingTopLevelBlockIds(editor.state.doc);
  const tr = buildBlockIdTransaction(editor, updates, editor.state.tr);
  if (!tr) return;

  editor.view.dispatch(tr);
}

export type ResolvedCommentBlock = {
  blockId: string;
  blockIndex: number;
};

/** Resolve the comment's block from the document position, assigning a block id when needed. */
export function resolveCommentBlock(
  editor: Editor,
  pos: number,
): ResolvedCommentBlock | null {
  const match = getTopLevelBlockAtPos(editor, pos);
  if (!match) return null;

  return resolveCommentBlockFromMatch(editor, match);
}

function resolveCommentBlockFromMatch(
  editor: Editor,
  match: TopLevelBlockMatch,
): ResolvedCommentBlock {
  const blockIndex = match.index;

  const existing = readBlockId(match.node);
  if (existing) {
    return { blockId: existing, blockIndex };
  }

  const blockId = createBlockId();
  if (trySetBlockIdOnMatch(editor, match, blockId)) {
    const updated = editor.state.doc.nodeAt(match.pos);
    return {
      blockId: (updated && readBlockId(updated)) ?? blockId,
      blockIndex,
    };
  }

  return { blockId: "", blockIndex };
}

/** @deprecated Use resolveCommentBlock instead. */
export function getOrAssignBlockIdForPos(
  editor: Editor,
  pos: number,
): string | null {
  return resolveCommentBlock(editor, pos)?.blockId ?? null;
}
