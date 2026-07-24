import { describe, expect, it } from "vitest";
import { conflictComparePanes } from "@/lib/offline/conflict-compare-panes";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";

function blockCluster(
  baseText: string,
  mineText: string,
  theirsText: string,
): SpanConflictCluster {
  return {
    id: "c1",
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
  it("diffs mine against theirs, not each side against base", () => {
    const cluster = blockCluster(
      "Hello world",
      "Hello A world",
      "Hello B world",
    );
    const panes = conflictComparePanes(cluster);

    expect(panes.mine.label).toBe("Your version");
    expect(panes.mine.text).toBe("Hello A world");
    expect(panes.mine.otherText).toBe("Hello B world");
    expect(panes.theirs.text).toBe("Hello B world");
    expect(panes.theirs.otherText).toBe("Hello A world");
  });
});
