import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import { threeWayMergeText } from "@/lib/documents/text-diff";
import { conflictCharRangesForBlock } from "@/lib/offline/conflict-highlight-ranges";

export type BlockText = {
  blockId: string;
  blockIndex: number;
  text: string;
};

export type BlockConflictKind =
  | "both_edited"
  | "mine_edited_peer_deleted"
  | "mine_deleted_peer_edited"
  | "peer_added"
  | "mine_added"
  | "peer_deleted_clean";

export type BlockEntry = BlockText & { node: ProseMirrorJsonNode };

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
  kind?: BlockConflictKind;
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

/** Ordered top-level blocks from a Y.Doc. */
export function extractOrderedBlocks(doc: Y.Doc): BlockEntry[] {
  const json = yDocToProsemirrorJSON(doc, "default") as {
    content?: ProseMirrorJsonNode[];
  };
  const blocks: BlockEntry[] = [];

  (json.content ?? []).forEach((node, index) => {
    const blockId = node.attrs?.blockId;
    if (typeof blockId !== "string" || !blockId) return;
    blocks.push({
      blockId,
      blockIndex: index,
      text: plainFromNode(node).trim(),
      node,
    });
  });

  return blocks;
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

/** Whether peer deferred updates changed this block relative to the offline base. */
export function peerTouchedBlock(
  blockId: string,
  baseDoc: Y.Doc,
  peerDoc: Y.Doc,
): boolean {
  const baseBlocks = extractBlockTexts(baseDoc);
  const peerBlocks = extractBlockTexts(peerDoc);
  const inBase = baseBlocks.has(blockId);
  const inPeer = peerBlocks.has(blockId);
  const baseText = baseBlocks.get(blockId)?.text ?? "";
  const peerText = peerBlocks.get(blockId)?.text ?? "";

  if (inBase && inPeer) {
    return peerText !== baseText;
  }
  if (!inBase && inPeer) {
    return true;
  }
  if (inBase && !inPeer) {
    // Missing blockId in peer extract alone is often CRDT structure noise —
    // require an actual block-count drop to treat as a peer delete.
    return (
      extractOrderedBlocks(peerDoc).length < extractOrderedBlocks(baseDoc).length
    );
  }
  return false;
}

/** True when every offline edit is local — no peer changed any block we touched. */
export function offlineSessionHasOnlyLocalEdits(
  baseDoc: Y.Doc,
  mineDoc: Y.Doc,
  peerDoc: Y.Doc,
): boolean {
  const baseBlocks = extractBlockTexts(baseDoc);
  const mineBlocks = extractBlockTexts(mineDoc);
  let hasLocalEdit = false;

  for (const blockId of collectBlockIds(baseBlocks, mineBlocks)) {
    const baseText = baseBlocks.get(blockId)?.text ?? "";
    const mineText = mineBlocks.get(blockId)?.text ?? "";
    if (mineText === baseText) continue;
    hasLocalEdit = true;
    if (peerTouchedBlock(blockId, baseDoc, peerDoc)) {
      return false;
    }
  }

  return hasLocalEdit;
}

function inferConflictKind(params: {
  inBase: boolean;
  inMine: boolean;
  inPeer: boolean;
  baseText: string;
  mineText: string;
  peerText: string;
}): BlockConflictKind | null {
  const { inBase, inMine, inPeer, baseText, mineText, peerText } = params;

  if (!inBase && !inMine && inPeer) return "peer_added";
  if (!inBase && inMine && !inPeer) return "mine_added";
  if (inBase && inMine && !inPeer && mineText === baseText) {
    return "peer_deleted_clean";
  }
  if (inBase && inMine && !inPeer && mineText !== baseText) {
    return "mine_edited_peer_deleted";
  }
  if (inBase && !inMine && inPeer && peerText !== baseText) {
    return "mine_deleted_peer_edited";
  }
  if (
    inMine &&
    inPeer &&
    mineText !== baseText &&
    peerText !== baseText &&
    mineText !== peerText
  ) {
    return "both_edited";
  }
  return null;
}

/**
 * True when every block we edited offline has peer changes merged in cleanly.
 * Returns false while peer edits are still in flight (merged still equals mine).
 * Solo / local-only edits settle without waiting for merged !== mine.
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

    if (mineText === baseText) continue;

    // Peer never touched this block — solo/local-only must settle immediately.
    if (!peerTouchedBlock(blockId, baseDoc, theirsDoc)) {
      continue;
    }

    // Peer edits not applied yet on a block we changed — keep waiting.
    if (mergedText === mineText) return false;

    const merge = threeWayMergeText(baseText, mineText, rawTheirsText);
    if (!merge.ok) return false;
    if (merge.text !== mergedText) return false;
  }

  return true;
}

/**
 * Peer text for conflict detection on a single block.
 * Collapse to base only when the offline user edited and the peer did not touch.
 */
export function resolveTheirsForOfflineConflict(
  baseText: string,
  mineText: string,
  rawTheirsText: string,
  peerTouched: boolean,
): string {
  if (mineText !== baseText && !peerTouched) {
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
  options?: {
    kind?: BlockConflictKind;
    peerTouched?: boolean;
  },
): boolean {
  const kind = options?.kind;
  const peerTouched = options?.peerTouched;

  if (
    kind === "peer_added" ||
    kind === "mine_added" ||
    kind === "peer_deleted_clean"
  ) {
    return false;
  }

  if (
    kind === "mine_edited_peer_deleted" ||
    kind === "mine_deleted_peer_edited"
  ) {
    return peerTouched === true;
  }

  if (mineText === theirsText) return false;
  if (mineText === baseText && theirsText === baseText) return false;

  const offlineEdited = mineText !== baseText;
  if (!offlineEdited) return false;

  const peerEditedThisBlock =
    peerTouched !== undefined ? peerTouched : theirsText !== baseText;

  // Case A — only the offline returner edited this block; peer left it alone.
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
 * Returns blocks that need human review (Case C overlaps + structural delete conflicts).
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
    const inBase = baseBlocks.has(blockId);
    const inMine = mineBlocks.has(blockId);
    const inPeer = theirsBlocks.has(blockId);
    const baseText = baseBlocks.get(blockId)?.text ?? "";
    const mineText = mineBlocks.get(blockId)?.text ?? "";
    const rawTheirsText = theirsBlocks.get(blockId)?.text ?? "";
    const mergedText = mergedBlocks?.get(blockId)?.text ?? "";
    const peerTouched = peerTouchedBlock(blockId, baseDoc, theirsDoc);

    // Noisy missing blockId with unchanged block count is not a peer delete.
    const effectiveInPeer =
      inPeer || (inBase && !inPeer && !peerTouched);

    const kind = inferConflictKind({
      inBase,
      inMine,
      inPeer: effectiveInPeer,
      baseText,
      mineText,
      peerText: effectiveInPeer && !inPeer ? baseText : rawTheirsText,
    });

    if (
      kind === "peer_added" ||
      kind === "mine_added" ||
      kind === "peer_deleted_clean"
    ) {
      continue;
    }

    // Structural delete kinds only when peer actually touched (count drop).
    if (
      (kind === "mine_edited_peer_deleted" ||
        kind === "mine_deleted_peer_edited") &&
      !peerTouched
    ) {
      continue;
    }

    const theirsText = resolveTheirsForOfflineConflict(
      baseText,
      mineText,
      rawTheirsText,
      peerTouched,
    );

    const mergedForBlock = mergedBlocks ? mergedText : undefined;
    if (
      !blockNeedsConflictReview(
        baseText,
        mineText,
        theirsText,
        mergedForBlock,
        catchupComplete,
        { kind: kind ?? undefined, peerTouched },
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
      kind: kind ?? undefined,
    });
  }

  return conflicts.sort((a, b) => a.blockIndex - b.blockIndex);
}
