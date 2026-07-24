import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";

export type ConflictComparePane = {
  label: string;
  /** Diff baseline for this pane (the other side's version). */
  otherText: string;
  /** Full text shown in this pane. */
  text: string;
  variant: "mine" | "theirs";
  /** Short hint for the modal header. */
  changeHint: string;
};

/** Side-by-side mine vs theirs for the compare modal (not base-relative). */
export function conflictComparePanes(
  cluster: SpanConflictCluster,
): { mine: ConflictComparePane; theirs: ConflictComparePane } {
  const mineVariant = cluster.variants.find((v) => v.side === "mine");
  const theirsVariant = cluster.variants.find((v) => v.side === "theirs");
  const mineText = cluster.mineText;
  const theirsText = cluster.theirsText;
  const changeHint =
    mineVariant?.hunkText ??
    theirsVariant?.hunkText ??
    cluster.baseSlice ??
    mineText;

  return {
    mine: {
      label: "Your version",
      otherText: theirsText,
      text: mineText,
      variant: "mine",
      changeHint,
    },
    theirs: {
      label: "Their version",
      otherText: mineText,
      text: theirsText,
      variant: "theirs",
      changeHint,
    },
  };
}
