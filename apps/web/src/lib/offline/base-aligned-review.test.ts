import { describe, expect, it } from "vitest";
import {
  alignReviewClusterIds,
  buildBlockReviewModel,
  buildInlineReviewSegments,
  clusterReviewSummary,
  segmentsFromBaseDiff,
} from "@/lib/offline/base-aligned-review";

const UAT_BASE =
  "In the open world, effective collaboration is often considered the cornerstone of any successful enterprise. Teams that communicate clearly and share clear goals tend to achieve much higher productivity levels.In the private world, effective collaboration is often considered the cornerstone of any successful enterprise. Teams that communicate clearly and share clear goals tend to achieve much higher productivity levels. Moreover, fostering a workplace culture that values diversity and creative thinking can spark breakthrough innovations. Leaders must therefore invest time in building trust and providing their employees with the resources they need to thrive in a competitive market. User B";

const UAT_MINE =
  "Moreover, fostering a workplace culture that values diversity and creative thinking can spark breakthrough innovations. Leaders must therefore invest time in building trust and providing their employees with the resources they need to thrive in a competitive market. User B";

const UAT_THEIRS =
  "In the open world, effective collaboration is often considered the cornerstone of any successful enterprise. All Teams which do communicate clearly and share clear goals tend to achieve much higher productivity levels. In the private world, effective collaboration is often considered the cornerstone of any successful enterprise. Teams that communicate clearly and share clear goals tend to achieve much higher productivity levels. Moreover, fostering a workplace culture that values diversity and creative thinking can spark breakthrough innovations. Leaders must therefore invest time in building trust and providing their employees with the resources they need to thrive in a competitive market. User B";

describe("base-aligned-review", () => {
  it("builds mine modal segments from base, not mine-vs-theirs", () => {
    const mineSegments = segmentsFromBaseDiff(
      "Hello world",
      "Hello A world",
      "mine",
    );

    expect(mineSegments.some((segment) => segment.role === "mine_del")).toBe(
      false,
    );
    expect(mineSegments.some((segment) => segment.role === "mine_add")).toBe(
      true,
    );
    expect(
      mineSegments
        .filter((segment) => segment.role === "mine_add")
        .map((segment) => segment.text)
        .join(""),
    ).toContain("A");
  });

  it("shows peer rewrites separately from mine deletions for UAT paragraph", () => {
    const review = alignReviewClusterIds(
      buildBlockReviewModel({
        blockId: "b1",
        blockIndex: 0,
        baseText: UAT_BASE,
        mineText: UAT_MINE,
        theirsText: UAT_THEIRS,
      }),
      [{ id: "b1:0", blockId: "b1", baseStart: 0 }],
    );

    const mineDels = review.mineSegments
      .filter((segment) => segment.role === "mine_del")
      .map((segment) => segment.text)
      .join("");
    expect(mineDels).toContain("In the open world");

    expect(
      review.peerSegments.some(
        (segment) => segment.role === "peer_add" || segment.role === "peer_del",
      ),
    ).toBe(true);

    const inlineMineDel = review.segments
      .filter((segment) => segment.role === "mine_del")
      .map((segment) => segment.text)
      .join("");
    expect(inlineMineDel.length).toBeGreaterThan(0);

    const clusterId = review.segments.find(
      (segment) => segment.role === "mine_del",
    )?.clusterId;
    expect(clusterId).toBe("b1:0");

    const summary = clusterReviewSummary(review, "b1:0");
    expect(summary).toContain("You");
  });

  it("assigns one cluster id to all contested inline segments", () => {
    const review = buildBlockReviewModel({
      blockId: "b1",
      blockIndex: 0,
      baseText: "alpha beta gamma delta",
      mineText: "alpha GAMMA delta",
      theirsText: "alpha BETA gamma delta",
      spanClusterId: "b1:0",
    });

    const clusterIds = new Set(
      review.segments
        .filter((segment) => segment.role !== "context")
        .map((segment) => segment.clusterId),
    );
    expect(clusterIds.size).toBe(1);
    expect(clusterIds.has("b1:0")).toBe(true);
  });
});
