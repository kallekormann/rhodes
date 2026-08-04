import { describe, expect, it } from "vitest";
import { degreeEmphasis, showCommunitiesEnabled } from "@/lib/views/knowledge-graph";

describe("degreeEmphasis", () => {
  it("normalizes degree to a 0-1 range", () => {
    expect(degreeEmphasis(0, 10)).toBe(0);
    expect(degreeEmphasis(5, 10)).toBe(0.5);
    expect(degreeEmphasis(10, 10)).toBe(1);
    expect(degreeEmphasis(3, 0)).toBe(0);
  });
});

describe("showCommunitiesEnabled", () => {
  it("defaults to true unless explicitly disabled", () => {
    expect(showCommunitiesEnabled({})).toBe(true);
    expect(showCommunitiesEnabled({ showCommunities: false })).toBe(false);
    expect(showCommunitiesEnabled({ showCommunities: true })).toBe(true);
  });
});
