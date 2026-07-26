import { hunkCharRange } from "@/lib/documents/text-diff";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";
import { clusterMineHighlightRange } from "@/lib/offline/span-conflict-clusters";

function clusterId(blockId: string, index: number): string {
  return `${blockId}:${index}`;
}

/** Merge multiple span clusters in the same block into one decision unit. */
export function coalesceSpanClustersByBlock(
  clusters: SpanConflictCluster[],
): SpanConflictCluster[] {
  const byBlock = new Map<string, SpanConflictCluster[]>();

  for (const cluster of clusters) {
    const list = byBlock.get(cluster.blockId) ?? [];
    list.push(cluster);
    byBlock.set(cluster.blockId, list);
  }

  const merged: SpanConflictCluster[] = [];

  for (const blockClusters of byBlock.values()) {
    if (blockClusters.length === 1) {
      merged.push(blockClusters[0]);
      continue;
    }

    const sorted = [...blockClusters].sort((a, b) => a.baseStart - b.baseStart);
    const first = sorted[0];
    const minStart = Math.min(...sorted.map((cluster) => cluster.baseStart));
    const maxEnd = Math.max(...sorted.map((cluster) => cluster.baseEnd));

    const draft: SpanConflictCluster = {
      ...first,
      id: clusterId(first.blockId, 0),
      baseStart: minStart,
      baseEnd: maxEnd,
      baseSlice: first.baseText.slice(minStart, maxEnd),
      highlightStart: 0,
      highlightEnd: 0,
      colorIndex: 0,
      variants: first.variants,
    };
    const mineHighlight = clusterMineHighlightRange(draft);
    merged.push({
      ...draft,
      highlightStart: mineHighlight.start,
      highlightEnd: mineHighlight.end,
    });
  }

  return merged.sort((a, b) => {
    if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
    return a.baseStart - b.baseStart;
  });
}

/** Expand a cluster char range on base to include all overlapping peer/mine hunks. */
export function clusterBaseCharSpan(cluster: SpanConflictCluster): {
  start: number;
  end: number;
} {
  const mineVariant = cluster.variants.find((variant) => variant.side === "mine");
  const theirsVariant = cluster.variants.find((variant) => variant.side === "theirs");

  let start = cluster.baseStart;
  let end = cluster.baseEnd;

  if (mineVariant) {
    const range = hunkCharRange(cluster.baseText, mineVariant.hunk);
    start = Math.min(start, range.start);
    end = Math.max(end, range.end);
  }
  if (theirsVariant) {
    const range = hunkCharRange(cluster.baseText, theirsVariant.hunk);
    start = Math.min(start, range.start);
    end = Math.max(end, range.end);
  }

  return {
    start: Math.max(0, start),
    end: Math.min(cluster.baseText.length, end),
  };
}
