import { describe, expect, it } from "vitest";
import { coalesceSpanClustersByBlock } from "@/lib/offline/conflict-cluster-coalesce";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";

function cluster(
  blockId: string,
  index: number,
  baseStart: number,
  baseEnd: number,
): SpanConflictCluster {
  return {
    id: `${blockId}:${index}`,
    blockId,
    blockIndex: 0,
    baseText: "Hello world today",
    mineText: "Hello offline today",
    theirsText: "Hello online world",
    baseStart,
    baseEnd,
    baseSlice: "Hello world today".slice(baseStart, baseEnd),
    highlightStart: 0,
    highlightEnd: 5,
    colorIndex: index,
    variants: [],
  };
}

describe("coalesceSpanClustersByBlock", () => {
  it("merges multiple clusters in the same block into one", () => {
    const merged = coalesceSpanClustersByBlock([
      cluster("b1", 0, 0, 5),
      cluster("b1", 1, 6, 11),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("b1:0");
    expect(merged[0]?.baseStart).toBe(0);
    expect(merged[0]?.baseEnd).toBe(11);
  });

  it("keeps separate blocks separate", () => {
    const merged = coalesceSpanClustersByBlock([
      cluster("b1", 0, 0, 5),
      cluster("b2", 0, 0, 5),
    ]);

    expect(merged).toHaveLength(2);
  });
});
