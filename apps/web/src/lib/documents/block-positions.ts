import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { readBlockId } from "@/lib/documents/block-ids";

/** Resolve a top-level block by stable document position (0-based child index). */
export function getTopLevelBlockRange(
  doc: ProseMirrorNode,
  blockIndex: number,
): { from: number; to: number; node: ProseMirrorNode; text: string } | null {
  if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= doc.childCount) {
    return null;
  }

  let from = 0;
  for (let i = 0; i < blockIndex; i++) {
    from += doc.child(i).nodeSize;
  }

  const node = doc.child(blockIndex);
  return {
    from,
    to: from + node.nodeSize,
    node,
    text: node.textContent,
  };
}

/** Fallback when blockIndex is stale — first top-level block with this id. */
export function getTopLevelBlockRangeById(
  doc: ProseMirrorNode,
  blockId: string,
): { from: number; to: number; node: ProseMirrorNode; text: string; blockIndex: number } | null {
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const from = pos;
    const to = pos + node.nodeSize;
    if (readBlockId(node) === blockId) {
      return { from, to, node, text: node.textContent, blockIndex: i };
    }
    pos = to;
  }
  return null;
}

export function getTopLevelBlockRangeForConflict(
  doc: ProseMirrorNode,
  conflict: { blockId: string; blockIndex: number },
): { from: number; to: number; node: ProseMirrorNode; text: string; blockIndex: number } | null {
  const byIndex = getTopLevelBlockRange(doc, conflict.blockIndex);
  if (byIndex && readBlockId(byIndex.node) === conflict.blockId) {
    return { ...byIndex, blockIndex: conflict.blockIndex };
  }
  return getTopLevelBlockRangeById(doc, conflict.blockId);
}
