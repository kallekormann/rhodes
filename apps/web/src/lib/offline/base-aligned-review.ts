import {
  diffWords,
  hunkCharRange,
  hunksAgainstBaseText,
  type TextHunk,
} from "@/lib/documents/text-diff";
import type { PeerEditContributor } from "@/lib/offline/peer-edit-contributions";
import { peerContributorSummary } from "@/lib/offline/peer-edit-contributions";

export type ReviewSegmentRole =
  | "context"
  | "mine_add"
  | "mine_del"
  | "peer_add"
  | "peer_del";

export type ReviewSegment = {
  id: string;
  role: ReviewSegmentRole;
  text: string;
  clickable: boolean;
  clusterId: string;
  /** When true, text is not in mineText — render as a widget decoration. */
  phantom: boolean;
  /** Peer author when role is peer_* — drives per-user highlight color. */
  peerUserId?: string;
};

export type BlockReviewModel = {
  blockId: string;
  blockIndex: number;
  baseText: string;
  mineText: string;
  theirsText: string;
  peerContributors: PeerEditContributor[];
  /** Inline editor stream (mine text + phantom peer / deleted segments). */
  segments: ReviewSegment[];
  /** Modal left column: base → mine. */
  mineSegments: ReviewSegment[];
  /** Modal right column: base → merged peers (or per-author in modal). */
  peerSegments: ReviewSegment[];
  /** Per-author modal columns when multiple peers edited this block. */
  peerAuthorSegments: Array<{
    userId: string;
    displayName: string;
    segments: ReviewSegment[];
  }>;
};

function nextSegmentId(counter: { value: number }): string {
  const id = `s${counter.value}`;
  counter.value += 1;
  return id;
}

/** One decision cluster per block — all contested spans share the same id. */
export function assignBlockClusterId(
  segments: ReviewSegment[],
  clusterId: string,
): void {
  for (const segment of segments) {
    segment.clusterId = segment.role === "context" ? "" : clusterId;
  }
}

/** @deprecated Prefer assignBlockClusterId for offline review. */
export function assignClusterIds(segments: ReviewSegment[]): void {
  let clusterIdx = 0;
  let inCluster = false;

  for (const segment of segments) {
    if (segment.role === "context") {
      segment.clusterId = "";
      inCluster = false;
      continue;
    }

    if (!inCluster) {
      clusterIdx += 1;
      inCluster = true;
    }
    segment.clusterId = `c${clusterIdx}`;
  }
}

/** Base-relative diff for one side (modal columns). */
export function segmentsFromBaseDiff(
  base: string,
  side: string,
  sideKind: "mine" | "peer",
): ReviewSegment[] {
  const diff = diffWords(base, side);
  const counter = { value: 0 };
  const segments: ReviewSegment[] = [];

  for (const part of diff) {
    if (!part.text) continue;

    if (part.type === "equal") {
      segments.push({
        id: nextSegmentId(counter),
        role: "context",
        text: part.text,
        clickable: false,
        clusterId: "",
        phantom: false,
      });
      continue;
    }

    if (part.type === "del") {
      segments.push({
        id: nextSegmentId(counter),
        role: sideKind === "mine" ? "mine_del" : "peer_del",
        text: part.text,
        clickable: sideKind === "mine",
        clusterId: "",
        phantom: sideKind === "mine",
      });
      continue;
    }

    segments.push({
      id: nextSegmentId(counter),
      role: sideKind === "mine" ? "mine_add" : "peer_add",
      text: part.text,
      clickable: sideKind === "mine",
      clusterId: "",
      phantom: false,
    });
  }

  return segments;
}

function hunkOverlapsCharRange(
  base: string,
  hunk: TextHunk,
  start: number,
  end: number,
): boolean {
  const range = hunkCharRange(base, hunk);
  return range.start < end && start < range.end;
}

function peerPhantomSegmentsForRange(
  base: string,
  theirs: string,
  start: number,
  end: number,
  counter: { value: number },
  emitted: Set<string>,
  peerUserId?: string,
): ReviewSegment[] {
  const hunks = hunksAgainstBaseText(base, theirs);
  const segments: ReviewSegment[] = [];

  for (const hunk of hunks) {
    if (!hunkOverlapsCharRange(base, hunk, start, end)) continue;

    const range = hunkCharRange(base, hunk);
    const clipStart = Math.max(range.start, start);
    const clipEnd = Math.min(range.end, end);
    const removed = base.slice(clipStart, clipEnd);
    const inserted = hunk.insert.join("");

    if (removed) {
      const key = `del:${clipStart}:${clipEnd}:${removed}`;
      if (!emitted.has(key)) {
        emitted.add(key);
        segments.push({
          id: nextSegmentId(counter),
          role: "peer_del",
          text: removed,
          clickable: false,
          clusterId: "",
          phantom: true,
          peerUserId,
        });
      }
    }

    if (inserted && range.start >= start && range.start < end) {
      const key = `add:${range.start}:${inserted}`;
      if (!emitted.has(key)) {
        emitted.add(key);
        segments.push({
          id: nextSegmentId(counter),
          role: "peer_add",
          text: inserted,
          clickable: false,
          clusterId: "",
          phantom: true,
          peerUserId,
        });
      }
    }
  }

  return segments;
}

/**
 * Inline review stream aligned to base, rendered on top of mineText.
 * Phantom segments show peer edits and your deletions.
 */
export function buildInlineReviewSegments(
  base: string,
  mine: string,
  theirs: string,
  peerContributors: PeerEditContributor[] = [],
): ReviewSegment[] {
  const output: ReviewSegment[] = [];
  const counter = { value: 0 };
  const emittedPeer = new Set<string>();
  let baseChar = 0;

  const mineDiff = diffWords(base, mine);
  const contributorRanges =
    peerContributors.length > 0
      ? peerContributors
      : [{ userId: "peer-merged", displayName: "Others", blockText: theirs } as PeerEditContributor];

  const push = (segment: Omit<ReviewSegment, "id" | "clusterId">) => {
    output.push({
      id: nextSegmentId(counter),
      clusterId: "",
      ...segment,
    });
  };

  const pushPeerRange = (start: number, end: number) => {
    for (const contributor of contributorRanges) {
      for (const segment of peerPhantomSegmentsForRange(
        base,
        contributor.blockText || theirs,
        start,
        end,
        counter,
        emittedPeer,
        contributor.userId,
      )) {
        output.push(segment);
      }
    }
  };

  for (const part of mineDiff) {
    if (part.type === "equal") {
      const regionEnd = baseChar + part.text.length;
      pushPeerRange(baseChar, regionEnd);
      push({
        role: "context",
        text: part.text,
        clickable: false,
        phantom: false,
      });
      baseChar = regionEnd;
      continue;
    }

    if (part.type === "del") {
      const regionEnd = baseChar + part.text.length;
      pushPeerRange(baseChar, regionEnd);
      push({
        role: "mine_del",
        text: part.text,
        clickable: true,
        phantom: true,
      });
      baseChar = regionEnd;
      continue;
    }

    pushPeerRange(baseChar, baseChar);
    push({
      role: "mine_add",
      text: part.text,
      clickable: true,
      phantom: false,
    });
  }

  pushPeerRange(baseChar, base.length);

  return output;
}

export function buildBlockReviewModel(params: {
  blockId: string;
  blockIndex: number;
  baseText: string;
  mineText: string;
  theirsText: string;
  peerContributors?: PeerEditContributor[];
  spanClusterId?: string;
}): BlockReviewModel {
  const peerContributors = params.peerContributors ?? [];
  const mineSegments = segmentsFromBaseDiff(
    params.baseText,
    params.mineText,
    "mine",
  );
  const peerSegments = segmentsFromBaseDiff(
    params.baseText,
    params.theirsText,
    "peer",
  );
  const inlineSegments = buildInlineReviewSegments(
    params.baseText,
    params.mineText,
    params.theirsText,
    peerContributors,
  );

  const clusterId = params.spanClusterId ?? "c1";
  assignBlockClusterId(inlineSegments, clusterId);
  assignBlockClusterId(mineSegments, clusterId);
  assignBlockClusterId(peerSegments, clusterId);

  const peerAuthorSegments =
    peerContributors.length > 0
      ? peerContributors.map((contributor) => {
          const segments = segmentsFromBaseDiff(
            params.baseText,
            contributor.blockText || params.theirsText,
            "peer",
          );
          assignBlockClusterId(segments, clusterId);
          return {
            userId: contributor.userId,
            displayName: contributor.displayName,
            segments,
          };
        })
      : [
          {
            userId: "peer-merged",
            displayName: "Others",
            segments: peerSegments,
          },
        ];

  return {
    blockId: params.blockId,
    blockIndex: params.blockIndex,
    baseText: params.baseText,
    mineText: params.mineText,
    theirsText: params.theirsText,
    peerContributors,
    segments: inlineSegments,
    mineSegments,
    peerSegments,
    peerAuthorSegments,
  };
}

export function reviewForBlock(
  reviews: BlockReviewModel[],
  blockId: string,
): BlockReviewModel | undefined {
  return reviews.find((review) => review.blockId === blockId);
}

/** Map inline segment cluster runs (c1, c2, …) to span cluster ids (blockId:index). */
export function alignReviewClusterIds(
  review: BlockReviewModel,
  spanClusters: Array<{ id: string; blockId: string; baseStart: number }>,
): BlockReviewModel {
  const blockCluster = spanClusters
    .filter((cluster) => cluster.blockId === review.blockId)
    .sort((a, b) => a.baseStart - b.baseStart)[0];

  if (!blockCluster) return review;

  const clusterId = blockCluster.id;
  const segments = review.segments.map((segment) => ({ ...segment }));
  const mineSegments = review.mineSegments.map((segment) => ({ ...segment }));
  const peerSegments = review.peerSegments.map((segment) => ({ ...segment }));
  const peerAuthorSegments = review.peerAuthorSegments.map((author) => ({
    ...author,
    segments: author.segments.map((segment) => ({ ...segment })),
  }));

  assignBlockClusterId(segments, clusterId);
  assignBlockClusterId(mineSegments, clusterId);
  assignBlockClusterId(peerSegments, clusterId);
  for (const author of peerAuthorSegments) {
    assignBlockClusterId(author.segments, clusterId);
  }

  return {
    ...review,
    segments,
    mineSegments,
    peerSegments,
    peerAuthorSegments,
  };
}

export function buildBlockReviewModels(
  conflicts: Array<{
    blockId: string;
    blockIndex: number;
    baseText: string;
    mineText: string;
    theirsText: string;
  }>,
  spanClusters: Array<{ id: string; blockId: string; baseStart: number }>,
  peerContributorsByBlock?: Map<string, PeerEditContributor[]>,
): BlockReviewModel[] {
  return conflicts.map((conflict) => {
    const blockClusterId = spanClusters.find(
      (cluster) => cluster.blockId === conflict.blockId,
    )?.id;
    return alignReviewClusterIds(
      buildBlockReviewModel({
        ...conflict,
        peerContributors: peerContributorsByBlock?.get(conflict.blockId) ?? [],
        spanClusterId: blockClusterId,
      }),
      spanClusters,
    );
  });
}

/** Human-readable summary for the conflict float / modal header. */
export function clusterReviewSummary(
  review: BlockReviewModel,
  clusterId: string,
): string {
  const parts = review.segments.filter((segment) => segment.clusterId === clusterId);
  if (parts.length === 0) {
    return "";
  }

  const mineChanged = parts.some((segment) => segment.role.startsWith("mine"));
  const peerChanged = parts.some((segment) => segment.role.startsWith("peer"));
  const peerNames = peerContributorSummary(review.peerContributors);

  const mineDels = parts
    .filter((segment) => segment.role === "mine_del")
    .map((segment) => segment.text.trim())
    .filter(Boolean);
  const mineAdds = parts
    .filter((segment) => segment.role === "mine_add")
    .map((segment) => segment.text.trim())
    .filter(Boolean);

  if (mineChanged && peerChanged) {
    if (mineDels.length > 0 && mineAdds.length === 0) {
      return `You removed text in this section. ${peerNames} also edited the same area.`;
    }
    if (mineAdds.length > 0 && mineDels.length === 0) {
      return `You rewrote this section. ${peerNames} also edited the same area.`;
    }
    return `You and ${peerNames} both changed this section.`;
  }

  if (mineChanged) {
    return mineDels.length > 0
      ? `You removed text in this section.`
      : `You edited this section.`;
  }

  if (peerChanged) {
    return `${peerNames} edited this section while you were offline.`;
  }

  return "This section needs your decision.";
}

/** Mine text offsets for one cluster — used for a single inline highlight band. */
export function clusterMineHighlightOffsets(
  review: BlockReviewModel,
  clusterId: string,
): { start: number; end: number } | null {
  let start = -1;
  let end = 0;
  let offset = 0;

  for (const segment of review.segments) {
    if (segment.phantom) continue;
    if (segment.clusterId === clusterId) {
      if (start < 0) start = offset;
      end = offset + segment.text.length;
    }
    offset += segment.text.length;
  }

  if (start < 0) return null;
  return { start, end };
}
