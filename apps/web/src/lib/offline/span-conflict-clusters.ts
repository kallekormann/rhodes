import {
  applyHunkToText,
  getTextTokens,
  hunksAgainstBaseText,
  hunksOverlap,
  hunkCharRange,
  type TextHunk,
} from "@/lib/documents/text-diff";
import {
  conflictCharRangesForBlock,
  type CharRange,
} from "@/lib/offline/conflict-highlight-ranges";
import type { ProseMirrorJsonNode } from "@/lib/offline/yjs-offline-divergence";

export type SpanConflictVariantSide = "base" | "mine" | "theirs";

export type SpanConflictVariant = {
  side: SpanConflictVariantSide;
  authorName: string;
  /** Full block text if this variant is chosen for the cluster. */
  blockText: string;
  /** Human-readable changed slice for the variant row. */
  hunkText: string;
  hunk: TextHunk;
};

export type SpanConflictCluster = {
  id: string;
  blockId: string;
  blockIndex: number;
  baseText: string;
  mineText: string;
  theirsText: string;
  baseStart: number;
  baseEnd: number;
  baseSlice: string;
  /** Highlight range in mineText (editor display during review). */
  highlightStart: number;
  highlightEnd: number;
  variants: SpanConflictVariant[];
  colorIndex: number;
  mineBlock?: ProseMirrorJsonNode;
  theirsBlock?: ProseMirrorJsonNode;
};

type TaggedHunk = TextHunk & { side: "mine" | "theirs" };

function clusterId(blockId: string, index: number): string {
  return `${blockId}:${index}`;
}

/** Highlight range in mineText for a span-level conflict cluster. */
export function clusterMineHighlightRange(
  cluster: SpanConflictCluster,
): CharRange {
  const blockRanges = conflictCharRangesForBlock({
    baseText: cluster.baseText,
    mineText: cluster.mineText,
    theirsText: cluster.theirsText,
  });

  const mineVariant = cluster.variants.find((v) => v.side === "mine");
  if (mineVariant) {
    const baseChar = hunkCharRange(cluster.baseText, mineVariant.hunk);
    const inserted = mineVariant.hunk.insert.join("");
    const hunkRange: CharRange = {
      start: baseChar.start,
      end: baseChar.start + inserted.length,
    };

    if (blockRanges.length > 0) {
      const blockRange = blockRanges[0];
      const start = Math.min(blockRange.start, hunkRange.start);
      const end = Math.max(blockRange.end, hunkRange.end);
      return {
        start: Math.max(0, start),
        end: Math.min(cluster.mineText.length, end),
      };
    }

    return {
      start: Math.max(0, hunkRange.start),
      end: Math.min(cluster.mineText.length, hunkRange.end),
    };
  }

  if (blockRanges.length > 0) {
    return blockRanges[0];
  }

  return {
    start: Math.max(0, cluster.baseStart),
    end: Math.min(cluster.mineText.length, cluster.baseEnd),
  };
}

/** Highlight range in theirsText for a span-level conflict cluster. */
export function clusterTheirsHighlightRange(
  cluster: SpanConflictCluster,
): CharRange {
  const blockRanges = conflictCharRangesForBlock({
    baseText: cluster.baseText,
    mineText: cluster.theirsText,
    theirsText: cluster.mineText,
  });

  const theirsVariant = cluster.variants.find((v) => v.side === "theirs");
  if (theirsVariant) {
    const baseChar = hunkCharRange(cluster.baseText, theirsVariant.hunk);
    const inserted = theirsVariant.hunk.insert.join("");
    const hunkRange: CharRange = {
      start: baseChar.start,
      end: baseChar.start + inserted.length,
    };

    if (blockRanges.length > 0) {
      const blockRange = blockRanges[0];
      const start = Math.min(blockRange.start, hunkRange.start);
      const end = Math.max(blockRange.end, hunkRange.end);
      return {
        start: Math.max(0, start),
        end: Math.min(cluster.theirsText.length, end),
      };
    }

    return {
      start: Math.max(0, hunkRange.start),
      end: Math.min(cluster.theirsText.length, hunkRange.end),
    };
  }

  if (blockRanges.length > 0) {
    return blockRanges[0];
  }

  return {
    start: Math.max(0, cluster.baseStart),
    end: Math.min(cluster.theirsText.length, cluster.baseEnd),
  };
}

function hunkDisplayText(hunk: TextHunk, baseText: string): string {
  const range = hunkCharRange(baseText, hunk);
  const removed = baseText.slice(range.start, range.end);
  const inserted = hunk.insert.join("");
  if (!removed && inserted) return `+ ${inserted}`;
  if (removed && !inserted) return `− ${removed}`;
  return `${removed} → ${inserted}`;
}

function blockTextForHunk(
  baseText: string,
  hunk: TextHunk,
  allHunks: TaggedHunk[],
  chosen: TaggedHunk,
): string {
  let text = baseText;
  const sorted = [...allHunks].sort((a, b) => {
    if (a.baseStart !== b.baseStart) return a.baseStart - b.baseStart;
    return a.baseEnd - b.baseEnd;
  });

  for (const h of sorted) {
    const overlapsChosen = hunksOverlap(h, chosen);
    const apply = overlapsChosen ? chosen : h;
    if (h.side !== apply.side && overlapsChosen) {
      text = applyHunkToText(text, chosen);
      continue;
    }
    if (!overlapsChosen) {
      text = applyHunkToText(text, h);
    }
  }

  if (!sorted.some((h) => hunksOverlap(h, chosen))) {
    text = applyHunkToText(text, chosen);
  }

  return text;
}

/** Group overlapping mine/theirs hunks into inline conflict clusters (Case C only). */
export function detectSpanConflictClusters(params: {
  blockId: string;
  blockIndex: number;
  baseText: string;
  mineText: string;
  theirsText: string;
  theirsAuthorName?: string;
  mineBlock?: ProseMirrorJsonNode;
  theirsBlock?: ProseMirrorJsonNode;
}): SpanConflictCluster[] {
  const {
    blockId,
    blockIndex,
    baseText,
    mineText,
    theirsText,
    theirsAuthorName = "Others",
    mineBlock,
    theirsBlock,
  } = params;

  if (mineText === theirsText || mineText === baseText && theirsText === baseText) {
    return [];
  }

  const mineHunks: TaggedHunk[] = hunksAgainstBaseText(baseText, mineText).map(
    (h) => ({ ...h, side: "mine" as const }),
  );
  const theirsHunks: TaggedHunk[] = hunksAgainstBaseText(baseText, theirsText).map(
    (h) => ({ ...h, side: "theirs" as const }),
  );

  const conflicting = new Set<TaggedHunk>();
  for (const mh of mineHunks) {
    for (const th of theirsHunks) {
      if (!hunksOverlap(mh, th)) continue;
      if (
        mh.baseStart === th.baseStart &&
        mh.baseEnd === th.baseEnd &&
        mh.insert.join("") === th.insert.join("")
      ) {
        continue;
      }
      conflicting.add(mh);
      conflicting.add(th);
    }
  }

  if (conflicting.size === 0) {
    return [];
  }

  const items = [...conflicting];
  const parent = items.map((_, i) => i);

  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };

  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (hunksOverlap(items[i], items[j])) union(i, j);
    }
  }

  const groups = new Map<number, TaggedHunk[]>();
  items.forEach((hunk, index) => {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(hunk);
    groups.set(root, list);
  });

  const allHunks = [...mineHunks, ...theirsHunks];
  const clusters: SpanConflictCluster[] = [];
  let colorIndex = 0;

  for (const group of groups.values()) {
    const minStart = Math.min(...group.map((h) => h.baseStart));
    const maxEnd = Math.max(...group.map((h) => h.baseEnd));
    const synthetic: TextHunk = {
      baseStart: minStart,
      baseEnd: maxEnd,
      insert: [],
    };
    const charRange = hunkCharRange(baseText, synthetic);

    const variants: SpanConflictVariant[] = [
      {
        side: "base",
        authorName: "Original",
        blockText: baseText,
        hunkText: baseText.slice(charRange.start, charRange.end) || "(empty)",
        hunk: synthetic,
      },
    ];

    for (const hunk of group) {
      const side = hunk.side;
      variants.push({
        side,
        authorName: side === "mine" ? "You" : theirsAuthorName,
        blockText: blockTextForHunk(baseText, hunk, allHunks, hunk),
        hunkText: hunkDisplayText(hunk, baseText),
        hunk,
      });
    }

    const draft: SpanConflictCluster = {
      id: clusterId(blockId, colorIndex),
      blockId,
      blockIndex,
      baseText,
      mineText,
      theirsText,
      baseStart: charRange.start,
      baseEnd: charRange.end,
      baseSlice: baseText.slice(charRange.start, charRange.end),
      highlightStart: 0,
      highlightEnd: 0,
      variants,
      colorIndex: colorIndex % 6,
      mineBlock,
      theirsBlock,
    };
    const mineHighlight = clusterMineHighlightRange(draft);
    clusters.push({
      ...draft,
      highlightStart: mineHighlight.start,
      highlightEnd: mineHighlight.end,
    });
    colorIndex += 1;
  }

  return clusters.sort((a, b) => {
    if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
    return a.baseStart - b.baseStart;
  });
}

/** Flatten block conflicts into span clusters for inline UI. */
export function clustersFromBlockConflicts(
  conflicts: Array<{
    blockId: string;
    blockIndex: number;
    baseText: string;
    mineText: string;
    theirsText: string;
    highlightStart?: number;
    highlightEnd?: number;
    mineBlock?: ProseMirrorJsonNode;
    theirsBlock?: ProseMirrorJsonNode;
  }>,
  theirsAuthorName?: string,
): SpanConflictCluster[] {
  return conflicts.flatMap((block, blockIdx) => {
    const clusters = detectSpanConflictClusters({
      ...block,
      theirsAuthorName,
    });
    if (clusters.length > 0) return clusters;

    const highlightStart = block.highlightStart ?? 0;
    const highlightEnd = block.highlightEnd ?? block.mineText.length;
    const draft: SpanConflictCluster = {
      id: clusterId(block.blockId, blockIdx),
      blockId: block.blockId,
      blockIndex: block.blockIndex,
      baseText: block.baseText,
      mineText: block.mineText,
      theirsText: block.theirsText,
      baseStart: highlightStart,
      baseEnd: highlightEnd,
      baseSlice: block.baseText.slice(highlightStart, highlightEnd),
      highlightStart,
      highlightEnd,
      colorIndex: 0,
      mineBlock: block.mineBlock,
      theirsBlock: block.theirsBlock,
      variants: [
          {
            side: "base",
            authorName: "Original",
            blockText: block.baseText,
            hunkText: block.baseText.slice(highlightStart, highlightEnd) || "(empty)",
            hunk: {
              baseStart: 0,
              baseEnd: getTextTokens(block.baseText).length,
              insert: [],
            },
          },
          {
            side: "mine",
            authorName: "You",
            blockText: block.mineText,
            hunkText: block.mineText,
            hunk: {
              baseStart: 0,
              baseEnd: getTextTokens(block.baseText).length,
              insert: getTextTokens(block.mineText),
            },
          },
          {
            side: "theirs",
            authorName: theirsAuthorName ?? "Others",
            blockText: block.theirsText,
            hunkText: block.theirsText,
            hunk: {
              baseStart: 0,
              baseEnd: getTextTokens(block.baseText).length,
              insert: getTextTokens(block.theirsText),
            },
          },
        ],
    };
    const mineHighlight = clusterMineHighlightRange(draft);
    return [{ ...draft, highlightStart: mineHighlight.start, highlightEnd: mineHighlight.end }];
  });
}
