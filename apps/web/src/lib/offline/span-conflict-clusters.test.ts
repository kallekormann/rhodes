import { describe, expect, it } from "vitest";
import { detectSpanConflictClusters } from "@/lib/offline/span-conflict-clusters";

describe("detectSpanConflictClusters", () => {
  it("returns no clusters when only one side changed", () => {
    const clusters = detectSpanConflictClusters({
      blockId: "b1",
      blockIndex: 0,
      baseText: "Hello world",
      mineText: "Hello offline",
      theirsText: "Hello world",
    });
    expect(clusters).toHaveLength(0);
  });

  it("returns one cluster for overlapping edits on the same span", () => {
    const clusters = detectSpanConflictClusters({
      blockId: "b1",
      blockIndex: 2,
      baseText: "Hello world",
      mineText: "Hello offline edit",
      theirsText: "Hello online edit",
    });
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    expect(clusters[0]?.variants.some((v) => v.side === "mine")).toBe(true);
    expect(clusters[0]?.variants.some((v) => v.side === "theirs")).toBe(true);
  });

  it("auto-merges non-overlapping prepend and append without clusters", () => {
    const clusters = detectSpanConflictClusters({
      blockId: "b1",
      blockIndex: 0,
      baseText: "world",
      mineText: "hello world",
      theirsText: "world today",
    });
    expect(clusters).toHaveLength(0);
  });
});
