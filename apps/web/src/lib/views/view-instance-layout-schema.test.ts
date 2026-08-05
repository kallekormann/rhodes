import { describe, expect, it } from "vitest";
import {
  createEmptyMindMapLayout,
  createEmptyWikiLayout,
} from "@rhodes/shared/view-engine";
import { viewInstanceLayoutSchema } from "./view-instance-layout-schema";

describe("viewInstanceLayoutSchema", () => {
  it("accepts mind-map layout v2", () => {
    const result = viewInstanceLayoutSchema.safeParse(createEmptyMindMapLayout());
    expect(result.success).toBe(true);
  });

  it("accepts wiki layout order maps", () => {
    const empty = viewInstanceLayoutSchema.safeParse(createEmptyWikiLayout());
    expect(empty.success).toBe(true);

    const ordered = viewInstanceLayoutSchema.safeParse({
      v: 1,
      order: {
        "root-1": ["child-b", "child-a"],
        "child-a": ["grandchild-1"],
      },
    });
    expect(ordered.success).toBe(true);
  });

  it("accepts legacy v1 position maps", () => {
    const result = viewInstanceLayoutSchema.safeParse({
      "doc-1": { x: 10, y: 20 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null", () => {
    expect(viewInstanceLayoutSchema.safeParse(null).success).toBe(true);
  });

  it("rejects v2 without root node", () => {
    const result = viewInstanceLayoutSchema.safeParse({
      v: 2,
      rootId: "missing",
      nodes: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects wiki layout without order", () => {
    const result = viewInstanceLayoutSchema.safeParse({ v: 1 });
    expect(result.success).toBe(false);
  });
});
