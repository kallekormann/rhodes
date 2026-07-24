import {
  buildBlockReviewModel,
  clusterReviewSummary,
  type BlockReviewModel,
  type ReviewSegment,
} from "@/lib/offline/base-aligned-review";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";

export type ConflictComparePane = {
  label: string;
  segments: ReviewSegment[];
  variant: "mine" | "peer";
  peerUserId?: string;
};

/** Base-relative columns for the compare modal (not mine-vs-theirs). */
export function conflictComparePanes(
  cluster: SpanConflictCluster,
  review?: BlockReviewModel,
): {
  mine: ConflictComparePane;
  peers: ConflictComparePane[];
  changeHint: string;
} {
  const model =
    review ??
    buildBlockReviewModel({
      blockId: cluster.blockId,
      blockIndex: cluster.blockIndex,
      baseText: cluster.baseText,
      mineText: cluster.mineText,
      theirsText: cluster.theirsText,
    });

  const changeHint =
    clusterReviewSummary(model, cluster.id) ||
    cluster.variants.find((variant) => variant.side === "mine")?.hunkText ||
    cluster.baseSlice ||
    cluster.mineText;

  const peers =
    model.peerAuthorSegments.length > 0
      ? model.peerAuthorSegments.map((author) => ({
          label: author.displayName,
          segments: author.segments,
          variant: "peer" as const,
          peerUserId: author.userId,
        }))
      : [
          {
            label:
              cluster.variants.find((variant) => variant.side === "theirs")
                ?.authorName ?? "Others",
            segments: model.peerSegments,
            variant: "peer" as const,
            peerUserId: "peer-merged",
          },
        ];

  return {
    mine: {
      label: "Your version",
      segments: model.mineSegments,
      variant: "mine",
    },
    peers,
    changeHint,
  };
}
