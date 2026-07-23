import type { Editor } from "@tiptap/react";
import { Node as PMNode } from "@tiptap/pm/model";
import { readBlockId } from "@/lib/documents/block-ids";
import type { ProseMirrorJsonNode } from "@/lib/offline/yjs-offline-divergence";

function findBlockRange(
  editor: Editor,
  blockId: string,
): { from: number; to: number } | null {
  const { state } = editor;
  let targetPos: number | null = null;
  let targetNodeSize = 0;

  state.doc.descendants((node, pos) => {
    if (targetPos != null) return false;
    if (readBlockId(node) !== blockId) return true;
    targetPos = pos;
    targetNodeSize = node.nodeSize;
    return false;
  });

  if (targetPos == null) return null;
  return { from: targetPos, to: targetPos + targetNodeSize };
}

export function blockJsonFromPlainText(
  editor: Editor,
  blockId: string,
  text: string,
): ProseMirrorJsonNode | null {
  const range = findBlockRange(editor, blockId);
  if (!range) return null;
  const node = editor.state.doc.nodeAt(range.from);
  if (!node) return null;

  return {
    type: node.type.name,
    attrs: { ...node.attrs, blockId },
    content: text ? [{ type: "text", text }] : [],
  };
}

/** Replace a top-level block from ProseMirror JSON (preserves marks e.g. bold). */
export function setBlockFromJson(
  editor: Editor,
  blockId: string,
  blockJson: ProseMirrorJsonNode,
): boolean {
  const range = findBlockRange(editor, blockId);
  if (!range) return false;

  try {
    const newNode = PMNode.fromJSON(editor.state.schema, blockJson);
    return editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.replaceWith(range.from, range.to, newNode);
        return true;
      })
      .run();
  } catch {
    return false;
  }
}

/** Replace a top-level block's inline text by blockId (plain text fallback). */
export function setBlockPlainText(
  editor: Editor,
  blockId: string,
  nextText: string,
): boolean {
  const range = findBlockRange(editor, blockId);
  if (!range) return false;

  const from = range.from + 1;
  const to = range.to - 1;

  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      if (from >= to) {
        if (from === to && nextText.length > 0) {
          tr.insertText(nextText, from);
        }
      } else {
        tr.insertText(nextText, from, to);
      }
      return true;
      })
    .run();
}

/**
 * Replace an entire block node (structural) so Yjs does not character-merge
 * with the peer's concurrent edit.
 */
export function replaceBlockForConflict(
  editor: Editor,
  blockId: string,
  text: string,
  blockJson?: ProseMirrorJsonNode,
): ProseMirrorJsonNode | null {
  const json =
    blockJson?.type != null
      ? blockJson
      : blockJsonFromPlainText(editor, blockId, text);
  if (!json) return null;
  if (!setBlockFromJson(editor, blockId, json)) return null;
  return json;
}
