import { describe, expect, it } from "vitest";
import { buildBlockReviewModel } from "@/lib/offline/base-aligned-review";
import { conflictComparePanes } from "@/lib/offline/conflict-compare-panes";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";

function blockCluster(
  baseText: string,
  mineText: string,
  theirsText: string,
): SpanConflictCluster {
  return {
    id: "b1:0",
    blockId: "b1",
    blockIndex: 0,
    baseText,
    mineText,
    theirsText,
    baseStart: 0,
    baseEnd: baseText.length,
    baseSlice: baseText,
    highlightStart: 0,
    highlightEnd: mineText.length,
    colorIndex: 0,
    variants: [
      {
        side: "mine",
        authorName: "You",
        blockText: mineText,
        hunkText: mineText,
        hunk: { baseStart: 0, baseEnd: 0, insert: [] },
      },
      {
        side: "theirs",
        authorName: "Others",
        blockText: theirsText,
        hunkText: theirsText,
        hunk: { baseStart: 0, baseEnd: 0, insert: [] },
      },
    ],
  };
}

describe("conflictComparePanes", () => {
  it("uses base-relative segments for each pane", () => {
    const cluster = blockCluster(
      "Hello world",
      "Hello A world",
      "Hello B world",
    );
    const review = buildBlockReviewModel({
      blockId: cluster.blockId,
      blockIndex: cluster.blockIndex,
      baseText: cluster.baseText,
      mineText: cluster.mineText,
      theirsText: cluster.theirsText,
      spanClusterId: cluster.id,
    });
    const panes = conflictComparePanes(cluster, review);

    expect(panes.mine.label).toBe("Your version");
    expect(panes.peers).toHaveLength(1);
    expect(panes.peers[0]?.label).toBe("Conflict version");
    expect(panes.mine.segments.some((segment) => segment.role === "mine_add")).toBe(
      true,
    );
    expect(panes.peers[0]?.segments.some((segment) => segment.role === "peer_add")).toBe(
      true,
    );
    expect(panes.changeHint).toContain("You");
  });

  it("labels the single conflict pane with the touching peer name", () => {
    const cluster = blockCluster(
      "Hello world",
      "Hello A world",
      "Hello B world",
    );
    const review = buildBlockReviewModel({
      blockId: cluster.blockId,
      blockIndex: cluster.blockIndex,
      baseText: cluster.baseText,
      mineText: cluster.mineText,
      theirsText: cluster.theirsText,
      spanClusterId: cluster.id,
      peerContributors: [
        {
          clientId: 1,
          userId: "user-b",
          displayName: "User B",
          blockText: "Hello B world",
          blockIndex: 0,
        },
        {
          clientId: 2,
          userId: "user-c",
          displayName: "User C",
          blockText: "Hello C world",
          blockIndex: 0,
        },
      ],
    });
    const panes = conflictComparePanes(cluster, review);
    expect(panes.peers).toHaveLength(1);
    expect(panes.peers[0]?.label).toBe("User B and User C");
    expect(panes.peers[0]?.segments).toBe(review.peerSegments);
  });
});