import { describe, expect, it } from "vitest";
import { threeWayMergeText } from "@/lib/documents/text-diff";

describe("offline Yjs block overlap detection", () => {
  it("auto-merges when only one side changed", () => {
    const result = threeWayMergeText(
      "Hello world",
      "Hello offline",
      "Hello world",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("Hello offline");
    }
  });

  it("flags Case C when both sides edited the same span differently", () => {
    const result = threeWayMergeText(
      "Hello world",
      "Hello offline edit",
      "Hello online edit",
    );
    expect(result.ok).toBe(false);
  });

  it("auto-merges prepend and append on the same block", () => {
    const result = threeWayMergeText(
      "world",
      "hello world",
      "world today",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("hello");
      expect(result.text).toContain("today");
    }
  });
});
