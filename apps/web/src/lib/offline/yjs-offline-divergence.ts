import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import { threeWayMergeText } from "@/lib/documents/text-diff";
import { conflictCharRangesForBlock } from "@/lib/offline/conflict-highlight-ranges";

export type BlockText = {
  blockId: string;
  blockIndex: number;
  text: string;
};

export type BlockConflict = BlockText & {
  baseText: string;
  mineText: string;
  theirsText: string;
  /** Inclusive start offset inside mineText for inline highlight. */
  highlightStart: number;
  /** Exclusive end offset inside mineText for inline highlight. */
  highlightEnd: number;
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

/** Document position for a block — disambiguates duplicate blockIds by text. */
export function findBlockIndexInDoc(
  doc: Y.Doc,
  blockId: string,
  expectedText?: string,
): number {
  const json = yDocToProsemirrorJSON(doc, "default") as {
    content?: ProseMirrorJsonNode[];
  };
  const nodes = json.content ?? [];
  const trimmedExpected = expectedText?.trim();

  if (trimmedExpected) {
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      if (node.attrs?.blockId !== blockId) continue;
      if (plainFromNode(node).trim() === trimmedExpected) return index;
    }
  }

  for (let index = 0; index < nodes.length; index++) {
    if (nodes[index].attrs?.blockId === blockId) return index;
  }

  return 0;
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
 * True when every block we edited offline has peer changes merged in cleanly.
 * Returns false while peer edits are still in flight (merged still equals mine).
 */
export function isOfflineMergeSettled(
  baseDoc: Y.Doc,
  mineDoc: Y.Doc,
  theirsDoc: Y.Doc,
  mergedDoc: Y.Doc,
): boolean {
  const baseBlocks = extractBlockTexts(baseDoc);
  const mineBlocks = extractBlockTexts(mineDoc);
  const theirsBlocks = extractBlockTexts(theirsDoc);
  const mergedBlocks = extractBlockTexts(mergedDoc);

  for (const blockId of collectBlockIds(baseBlocks, mineBlocks)) {
    const baseText = baseBlocks.get(blockId)?.text ?? "";
    const mineText = mineBlocks.get(blockId)?.text ?? "";
    const rawTheirsText = theirsBlocks.get(blockId)?.text ?? "";
    const mergedText = mergedBlocks.get(blockId)?.text ?? "";
    const theirsText = rawTheirsText;

    if (mineText === baseText) continue;

    // Peer edits not applied yet on a block we changed — keep waiting.
    if (mergedText === mineText) return false;

    const merge = threeWayMergeText(baseText, mineText, theirsText);
    if (!merge.ok) return false;
    if (merge.text !== mergedText) return false;
  }

  return true;
}

/**
 * Peer text for conflict detection on a single block.
 * When the offline user edited a block and deferred merge left it unchanged,
 * the peer did not touch this block — use base, not a polluted Yjs reconstruction.
 */
export function resolveTheirsForOfflineConflict(
  baseText: string,
  mineText: string,
  rawTheirsText: string,
  mergedText: string | undefined,
): string {
  if (
    mineText !== baseText &&
    mergedText !== undefined &&
    mergedText === mineText
  ) {
    return baseText;
  }
  return rawTheirsText;
}

/**
 * Whether the offline returner must manually review this block (Case C overlap).
 * Blocks only edited by peers while offline auto-merge — never shown in conflict UI.
 */
export function blockNeedsConflictReview(
  baseText: string,
  mineText: string,
  theirsText: string,
  mergedText: string | undefined,
  catchupComplete: boolean,
): boolean {
  if (mineText === theirsText) return false;
  if (mineText === baseText && theirsText === baseText) return false;

  const offlineEdited = mineText !== baseText;
  if (!offlineEdited) return false;

  const peerEditedThisBlock = theirsText !== baseText;

  // Case A — only the offline returner edited this block; peer left it alone.
  // Auto-merge without review even if CRDT merged state differs slightly on this block.
  if (!peerEditedThisBlock) {
    return false;
  }

  if (
    !catchupComplete &&
    mergedText !== undefined &&
    mergedText === mineText
  ) {
    return false;
  }

  const merge = threeWayMergeText(baseText, mineText, theirsText);
  const peerDiverged = peerEditedThisBlock && mineText !== theirsText;

  const crdtGarbled =
    catchupComplete &&
    mergedText !== undefined &&
    peerDiverged &&
    mergedText !== mineText &&
    mergedText !== theirsText &&
    (!merge.ok || (merge.ok && merge.text !== mergedText));

  const peerDivergedButMergedLocal =
    catchupComplete &&
    mergedText !== undefined &&
    mergedText === mineText &&
    peerDiverged;

  const peerWonSilently =
    catchupComplete &&
    mergedText !== undefined &&
    mineText !== theirsText &&
    mergedText === theirsText;

  return (
    crdtGarbled ||
    peerDivergedButMergedLocal ||
    peerWonSilently ||
    !merge.ok ||
    (merge.ok &&
      mergedText !== undefined &&
      merge.text !== mergedText)
  );
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
  options?: { catchupComplete?: boolean },
): BlockConflict[] {
  const catchupComplete = options?.catchupComplete ?? true;
  const baseBlocks = extractBlockTexts(baseDoc);
  const mineBlocks = extractBlockTexts(mineDoc);
  const theirsBlocks = extractBlockTexts(theirsDoc);
  const mergedBlocks = mergedDoc ? extractBlockTexts(mergedDoc) : null;
  const conflicts: BlockConflict[] = [];

  for (const blockId of collectBlockIds(baseBlocks, mineBlocks, theirsBlocks)) {
    const baseText = baseBlocks.get(blockId)?.text ?? "";
    const mineText = mineBlocks.get(blockId)?.text ?? "";
    const rawTheirsText = theirsBlocks.get(blockId)?.text ?? "";
    const mergedText = mergedBlocks?.get(blockId)?.text ?? "";
    const theirsText = resolveTheirsForOfflineConflict(
      baseText,
      mineText,
      rawTheirsText,
      mergedBlocks ? mergedText : undefined,
    );

    const mergedForBlock = mergedBlocks ? mergedText : undefined;
    if (
      !blockNeedsConflictReview(
        baseText,
        mineText,
        theirsText,
        mergedForBlock,
        catchupComplete,
      )
    ) {
      continue;
    }

    const blockIndex = findBlockIndexInDoc(mineDoc, blockId, mineText);

    const highlightRanges = conflictCharRangesForBlock({
      baseText,
      mineText,
      theirsText,
    });
    const highlight = highlightRanges[0] ?? {
      start: 0,
      end: mineText.length,
    };

    conflicts.push({
      blockId,
      blockIndex,
      text: mineText,
      baseText,
      mineText,
      theirsText,
      highlightStart: highlight.start,
      highlightEnd: highlight.end,
      mineBlock: extractBlockNode(mineDoc, blockId) ?? undefined,
      theirsBlock: extractBlockNode(theirsDoc, blockId) ?? undefined,
    });
  }

  return conflicts.sort((a, b) => a.blockIndex - b.blockIndex);
}
