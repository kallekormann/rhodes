import type { ProseMirrorJsonNode } from "@/lib/offline/yjs-offline-divergence";
import {
  extractOrderedBlocks,
  type BlockConflictKind,
  type BlockEntry,
} from "@/lib/offline/yjs-offline-divergence";
import { findXmlBlockById } from "@/lib/offline/yjs-offline-restore";
import * as Y from "yjs";

export const OFFLINE_CONFLICT_COMMIT_ORIGIN = "offline-conflict-commit";

export type ConflictDecision = {
  side: "mine" | "theirs";
};

export type BuildResolvedBlocksParams = {
  baseDoc: Y.Doc;
  mineDoc: Y.Doc;
  peerDoc: Y.Doc;
  decisions: Map<string, ConflictDecision>;
};

export function decisionKey(blockId: string, blockIndex: number): string {
  return `${blockId}:${blockIndex}`;
}

function decisionForBlock(
  decisions: Map<string, ConflictDecision>,
  blockId: string,
  blockIndex: number,
): ConflictDecision | undefined {
  const exact = decisions.get(decisionKey(blockId, blockIndex));
  if (exact) return exact;
  for (const [key, value] of decisions) {
    if (key === blockId || key.startsWith(`${blockId}:`)) return value;
  }
  return undefined;
}

function entryById(list: BlockEntry[]): Map<string, BlockEntry> {
  const map = new Map<string, BlockEntry>();
  for (const entry of list) {
    if (!map.has(entry.blockId)) {
      map.set(entry.blockId, entry);
    }
  }
  return map;
}

function baseIndexOf(baseList: BlockEntry[], blockId: string): number {
  const index = baseList.findIndex((entry) => entry.blockId === blockId);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

/** Ordered block ids: peer spine, with mine-only blocks spliced by base order. */
export function orderedBlockIdsForCommit(
  baseList: BlockEntry[],
  mineList: BlockEntry[],
  peerList: BlockEntry[],
): string[] {
  const peerIds = peerList.map((entry) => entry.blockId);
  const peerIdSet = new Set(peerIds);
  const mineOnly = mineList
    .filter((entry) => !peerIdSet.has(entry.blockId))
    .sort(
      (a, b) => baseIndexOf(baseList, a.blockId) - baseIndexOf(baseList, b.blockId),
    );

  const ordered: string[] = [];
  let mineOnlyIdx = 0;

  for (const peerEntry of peerList) {
    while (
      mineOnlyIdx < mineOnly.length &&
      baseIndexOf(baseList, mineOnly[mineOnlyIdx].blockId) <
        baseIndexOf(baseList, peerEntry.blockId)
    ) {
      ordered.push(mineOnly[mineOnlyIdx].blockId);
      mineOnlyIdx += 1;
    }
    ordered.push(peerEntry.blockId);
  }

  while (mineOnlyIdx < mineOnly.length) {
    ordered.push(mineOnly[mineOnlyIdx].blockId);
    mineOnlyIdx += 1;
  }

  return [...new Set(ordered)];
}

export function inferBlockKind(
  baseEntry: BlockEntry | undefined,
  mineEntry: BlockEntry | undefined,
  peerEntry: BlockEntry | undefined,
): BlockConflictKind | "auto" {
  const inBase = Boolean(baseEntry);
  const inMine = Boolean(mineEntry);
  const inPeer = Boolean(peerEntry);
  const baseText = baseEntry?.text ?? "";
  const mineText = mineEntry?.text ?? "";
  const peerText = peerEntry?.text ?? "";

  if (!inBase && !inMine && inPeer) return "peer_added";
  if (inBase && inMine && !inPeer && mineText === baseText) return "peer_deleted_clean";
  if (inBase && !inMine && inPeer && peerText === baseText) return "auto";
  if (inBase && inMine && !inPeer && mineText !== baseText) {
    return "mine_edited_peer_deleted";
  }
  if (inBase && !inMine && inPeer && peerText !== baseText) {
    return "mine_deleted_peer_edited";
  }
  if (!inBase && inMine && !inPeer) return "mine_added";
  if (
    inMine &&
    inPeer &&
    mineText !== baseText &&
    peerText !== baseText &&
    mineText !== peerText
  ) {
    return "both_edited";
  }
  return "auto";
}

type ResolveSide = "mine" | "peer" | "omit";

function resolveSideForBlock(params: {
  baseEntry?: BlockEntry;
  mineEntry?: BlockEntry;
  peerEntry?: BlockEntry;
  decision?: ConflictDecision;
}): ResolveSide {
  const { baseEntry, mineEntry, peerEntry, decision } = params;
  const baseText = baseEntry?.text ?? "";

  if (decision?.side === "mine") {
    return mineEntry ? "mine" : "omit";
  }

  if (decision?.side === "theirs") {
    if (!peerEntry && baseEntry) return "omit";
    return peerEntry ? "peer" : "omit";
  }

  if (!peerEntry && !mineEntry) return "omit";

  if (!peerEntry && mineEntry) {
    if (mineEntry.text === baseText) return "omit";
    return "mine";
  }

  if (!mineEntry && peerEntry) {
    // Skip empty peer-only inserts (TipTap padding) — they mint blank blocks on commit.
    if (!baseEntry && peerEntry.text.trim() === "") return "omit";
    if (!baseEntry) return "peer";
    if (peerEntry.text === baseText) return "omit";
    return "peer";
  }

  if (mineEntry && peerEntry) {
    if (mineEntry.text === baseText && peerEntry.text !== baseText) {
      return "peer";
    }
    if (peerEntry.text === baseText && mineEntry.text !== baseText) {
      return "mine";
    }
    if (mineEntry.text === peerEntry.text) {
      return "mine";
    }
  }

  return mineEntry ? "mine" : peerEntry ? "peer" : "omit";
}

function resolveNodeForBlock(params: {
  baseEntry?: BlockEntry;
  mineEntry?: BlockEntry;
  peerEntry?: BlockEntry;
  decision?: ConflictDecision;
}): ProseMirrorJsonNode | null {
  const side = resolveSideForBlock(params);
  if (side === "omit") return null;
  if (side === "mine") return params.mineEntry?.node ?? null;
  return params.peerEntry?.node ?? null;
}

export function buildResolvedBlocks(
  params: BuildResolvedBlocksParams,
): ProseMirrorJsonNode[] {
  const { baseDoc, mineDoc, peerDoc, decisions } = params;
  const baseList = extractOrderedBlocks(baseDoc);
  const mineList = extractOrderedBlocks(mineDoc);
  const peerList = extractOrderedBlocks(peerDoc);

  const baseById = entryById(baseList);
  const mineById = entryById(mineList);
  const peerById = entryById(peerList);

  const orderedIds = orderedBlockIdsForCommit(baseList, mineList, peerList);
  const resolved: ProseMirrorJsonNode[] = [];

  for (const blockId of orderedIds) {
    const baseEntry = baseById.get(blockId);
    const mineEntry = mineById.get(blockId);
    const peerEntry = peerById.get(blockId);
    const blockIndex =
      mineEntry?.blockIndex ?? peerEntry?.blockIndex ?? baseEntry?.blockIndex ?? 0;
    const decision = decisionForBlock(decisions, blockId, blockIndex);

    const node = resolveNodeForBlock({
      baseEntry,
      mineEntry,
      peerEntry,
      decision,
    });

    if (node) {
      resolved.push(node);
    }
  }

  return resolved;
}

/**
 * Ordered Xml blocks to clone into the live doc — preserves TipTap structure
 * without a ProseMirror round-trip that invents empty paragraphs.
 */
export function buildResolvedXmlBlocks(
  params: BuildResolvedBlocksParams,
): Y.XmlElement[] {
  const { baseDoc, mineDoc, peerDoc, decisions } = params;
  const baseList = extractOrderedBlocks(baseDoc);
  const mineList = extractOrderedBlocks(mineDoc);
  const peerList = extractOrderedBlocks(peerDoc);

  const baseById = entryById(baseList);
  const mineById = entryById(mineList);
  const peerById = entryById(peerList);

  const orderedIds = orderedBlockIdsForCommit(baseList, mineList, peerList);
  const blocks: Y.XmlElement[] = [];

  for (const blockId of orderedIds) {
    const baseEntry = baseById.get(blockId);
    const mineEntry = mineById.get(blockId);
    const peerEntry = peerById.get(blockId);
    const blockIndex =
      mineEntry?.blockIndex ?? peerEntry?.blockIndex ?? baseEntry?.blockIndex ?? 0;
    const decision = decisionForBlock(decisions, blockId, blockIndex);
    const side = resolveSideForBlock({
      baseEntry,
      mineEntry,
      peerEntry,
      decision,
    });

    if (side === "omit") continue;

    const sourceDoc = side === "mine" ? mineDoc : peerDoc;
    const xml = findXmlBlockById(sourceDoc, blockId);
    if (xml) {
      blocks.push(xml);
    }
  }

  return blocks;
}

export type ResolvedBlockPlanEntry = {
  blockId: string;
  side: "mine" | "peer";
  xml: Y.XmlElement;
};

/**
 * Same resolution as buildResolvedXmlBlocks, but also reports which side
 * ("mine" untouched vs "peer" replacement/insert) each resolved block came
 * from, so the commit can patch only what actually changed.
 */
export function buildResolvedBlockPlan(
  params: BuildResolvedBlocksParams,
): ResolvedBlockPlanEntry[] {
  const { baseDoc, mineDoc, peerDoc, decisions } = params;
  const baseList = extractOrderedBlocks(baseDoc);
  const mineList = extractOrderedBlocks(mineDoc);
  const peerList = extractOrderedBlocks(peerDoc);

  const baseById = entryById(baseList);
  const mineById = entryById(mineList);
  const peerById = entryById(peerList);

  const orderedIds = orderedBlockIdsForCommit(baseList, mineList, peerList);
  const plan: ResolvedBlockPlanEntry[] = [];

  for (const blockId of orderedIds) {
    const baseEntry = baseById.get(blockId);
    const mineEntry = mineById.get(blockId);
    const peerEntry = peerById.get(blockId);
    const blockIndex =
      mineEntry?.blockIndex ?? peerEntry?.blockIndex ?? baseEntry?.blockIndex ?? 0;
    const decision = decisionForBlock(decisions, blockId, blockIndex);
    const side = resolveSideForBlock({ baseEntry, mineEntry, peerEntry, decision });

    if (side === "omit") continue;

    const sourceDoc = side === "mine" ? mineDoc : peerDoc;
    const xml = findXmlBlockById(sourceDoc, blockId);
    if (xml) {
      plan.push({ blockId, side, xml });
    }
  }

  return plan;
}
