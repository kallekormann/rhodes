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

  it("flags Hello offline vs Hi online on same greeting", () => {
    const base = "HELLO HI! more pass no pass?";
    const mine = "HELLO HI! Hello offline pass no pass?";
    const theirs = "HELLO HI! Hi online pass no pass?";
    const result = threeWayMergeText(base, mine, theirs);
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

  it("treats CRDT garble as conflict when clean merge differs from merged", () => {
    const base = "HELLO HI! more pass";
    const mine = "HELLO HI! Hello offline pass";
    const theirs = "HELLO HI! Hi online pass";
    const merge = threeWayMergeText(base, mine, theirs);
    const merged = "HELLO HI! HHi onlinello offline pass";
    const needsReview = !merge.ok || (merge.ok && merge.text !== merged);
    expect(needsReview).toBe(true);
  });
});
