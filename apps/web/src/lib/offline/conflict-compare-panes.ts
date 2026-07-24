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
  /** Short hint for the modal header. */
  changeHint: string;
};

/** Base-relative columns for the compare modal (not mine-vs-theirs). */
export function conflictComparePanes(
  cluster: SpanConflictCluster,
  review?: BlockReviewModel,
): { mine: ConflictComparePane; theirs: ConflictComparePane } {
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

  const theirsLabel =
    cluster.variants.find((variant) => variant.side === "theirs")?.authorName ??
    "Their changes";

  return {
    mine: {
      label: "Your changes",
      segments: model.mineSegments,
      variant: "mine",
      changeHint,
    },
    theirs: {
      label: theirsLabel,
      segments: model.peerSegments,
      variant: "peer",
      changeHint,
    },
  };
}
