import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import { threeWayMergeText } from "@/lib/documents/text-diff";

export type BlockText = {
  blockId: string;
  blockIndex: number;
  text: string;
};

export type BlockConflict = BlockText & {
  baseText: string;
  mineText: string;
  theirsText: string;
  mineBlock?: ProseMirrorJsonNode;
  theirsBlock?: ProseMirrorJsonNode;
};

export type ProseMirrorJsonNode = {
  type?: string;
  attrs?: { blockId?: string | null };
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: ProseMirrorJsonNode[];
};

function plainFromNode(node: ProseMirrorJsonNode): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map(plainFromNode).join("");
}

export function extractBlockNode(
  doc: Y.Doc,
  blockId: string,
): ProseMirrorJsonNode | null {
  const json = yDocToProsemirrorJSON(doc, "default") as {
    content?: ProseMirrorJsonNode[];
  };
  for (const node of json.content ?? []) {
    if (node.attrs?.blockId === blockId) return node;
  }
  return null;
}

/** Extract top-level block plain text keyed by blockId from a Y.Doc. */
export function extractBlockTexts(doc: Y.Doc): Map<string, BlockText> {
  const json = yDocToProsemirrorJSON(doc, "default") as {
    content?: ProseMirrorJsonNode[];
  };
  const blocks = new Map<string, BlockText>();
  const nodes = json.content ?? [];

  nodes.forEach((node, index) => {
    const blockId = node.attrs?.blockId;
    if (typeof blockId !== "string" || !blockId) return;
    blocks.set(blockId, {
      blockId,
      blockIndex: index,
      text: plainFromNode(node).trim(),
    });
  });

  return blocks;
}

function collectBlockIds(
  ...maps: Map<string, BlockText>[]
): string[] {
  const ids = new Set<string>();
  for (const map of maps) {
    for (const id of map.keys()) ids.add(id);
  }
  return [...ids];
}

/**
 * Compare base / mine / theirs Y.Docs per block.
 * Returns blocks that need human review (Case C overlaps).
 */
export function detectOfflineBlockConflicts(
  baseDoc: Y.Doc,
  mineDoc: Y.Doc,
  theirsDoc: Y.Doc,
  mergedDoc?: Y.Doc,
): BlockConflict[] {
  const baseBlocks = extractBlockTexts(baseDoc);
  const mineBlocks = extractBlockTexts(mineDoc);
  const theirsBlocks = extractBlockTexts(theirsDoc);
  const mergedBlocks = mergedDoc ? extractBlockTexts(mergedDoc) : null;
  const conflicts: BlockConflict[] = [];

  for (const blockId of collectBlockIds(baseBlocks, mineBlocks, theirsBlocks)) {
    const baseText = baseBlocks.get(blockId)?.text ?? "";
    const mineText = mineBlocks.get(blockId)?.text ?? "";
    const theirsText = theirsBlocks.get(blockId)?.text ?? "";
    const mergedText = mergedBlocks?.get(blockId)?.text ?? "";

    if (mineText === theirsText) continue;
    if (mineText === baseText && theirsText === baseText) continue;

    const merge = threeWayMergeText(baseText, mineText, theirsText);

    // Offline returner: peer edits landed (merged ≠ mine) while we also changed the block.
    const peerChangedWhileOffline =
      mineText !== baseText && mergedText.length > 0 && mergedText !== mineText;

    const crdtGarbled =
      peerChangedWhileOffline &&
      mergedText !== theirsText &&
      (!merge.ok ||
        (merge.ok && merge.text !== mergedText));

    if (merge.ok && !crdtGarbled) continue;

    const blockIndex =
      mineBlocks.get(blockId)?.blockIndex ??
      theirsBlocks.get(blockId)?.blockIndex ??
      baseBlocks.get(blockId)?.blockIndex ??
      0;

    conflicts.push({
      blockId,
      blockIndex,
      text: mineText,
      baseText,
      mineText,
      theirsText,
      mineBlock: extractBlockNode(mineDoc, blockId) ?? undefined,
      theirsBlock: extractBlockNode(theirsDoc, blockId) ?? undefined,
    });
  }

  return conflicts.sort((a, b) => a.blockIndex - b.blockIndex);
}
