import {
  buildBlockReviewModel,
  clusterReviewSummary,
  type BlockReviewModel,
  type ReviewSegment,
} from "@/lib/offline/base-aligned-review";
import { peerContributorSummary } from "@/lib/offline/peer-edit-contributions";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";

export type ConflictComparePane = {
  label: string;
  segments: ReviewSegment[];
  variant: "mine" | "peer";
  peerUserId?: string;
};

/**
 * Two-column Diff Modal: Your version | Conflict version.
 * Never one pane per open-document user — parties belong in the float legend.
 */
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
    clusterReviewSummary(model, cluster.id, model.kind) ||
    cluster.variants.find((variant) => variant.side === "mine")?.hunkText ||
    cluster.baseSlice ||
    cluster.mineText;

  // Never silently collapse a resolved "Others" fallback into the generic
  // "Conflict version" copy — that masked whether attribution actually ran
  // and failed vs. never had contributor data at all, making the underlying
  // bug invisible during QA. Only fall back to "Conflict version" when there
  // is truly no contributor data yet (e.g. before the reactive re-attribution
  // effect gets its first pass).
  const peerLabel =
    model.peerContributors.length > 0
      ? peerContributorSummary(model.peerContributors)
      : (cluster.variants.find((variant) => variant.side === "theirs")
          ?.authorName ?? "Conflict version");

  const peerUserId =
    model.peerContributors.length === 1
      ? model.peerContributors[0].userId
      : model.peerContributors[0]?.userId ?? "peer-merged";

  return {
    mine: {
      label: "Your version",
      segments: model.mineSegments,
      variant: "mine",
    },
    peers: [
      {
        label: peerLabel,
        segments: model.peerSegments,
        variant: "peer",
        peerUserId,
      },
    ],
    changeHint,
  };
}
