import { describe, expect, it } from "vitest";
import { threeWayMergeText } from "@/lib/documents/text-diff";
import { blockNeedsConflictReview, resolveTheirsForOfflineConflict } from "@/lib/offline/yjs-offline-divergence";

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

  it("flags silent peer win when merged equals online version", () => {
    const base = "Lets add other big same content";
    const mine = "Lets add other big HELLO FROM OFFLINE content";
    const theirs = "Lets add other big HELLO FROM ONLINE content";
    const merged = theirs;
    const merge = threeWayMergeText(base, mine, theirs);
    const peerWonSilently =
      mine !== base && mine !== theirs && merged === theirs;
    const needsReview =
      peerWonSilently || !merge.ok || (merge.ok && merge.text !== merged);
    expect(peerWonSilently).toBe(true);
    expect(needsReview).toBe(true);
  });

  it("does not review peer-only block edits (UAT step 3 — different blocks)", () => {
    const base = "Original block two text";
    const mine = base;
    const theirs = "Original block two text edited by peer online";
    const merged = theirs;

    expect(
      blockNeedsConflictReview(base, mine, theirs, merged, true),
    ).toBe(false);
  });

  it("does not review clean auto-merge on offline-edited block when peer left it alone", () => {
    const base = "Block one original";
    const mine = "Block one offline edit";
    const theirs = base;
    const merged = mine;

    expect(
      blockNeedsConflictReview(base, mine, theirs, merged, true),
    ).toBe(false);
  });

  it("does not review when CRDT merged text drifts but peer did not edit this block", () => {
    const base = "Block one original";
    const mine = "Block one offline edit";
    const theirs = base;
    const mergedWithNoise = "Block one offline edit "; // trailing space from CRDT

    expect(
      blockNeedsConflictReview(base, mine, theirs, mergedWithNoise, true),
    ).toBe(false);
  });

  it("resolveTheirs uses base when peer did not touch an offline-edited block", () => {
    expect(
      resolveTheirsForOfflineConflict(
        "block one base",
        "block one mine",
        "block one polluted from yjs",
        "block one mine",
      ),
    ).toBe("block one base");
  });

  it("reviews overlapping edits on the same block (UAT step 4)", () => {
    const base = "Hello world";
    const mine = "Hello offline edit";
    const theirs = "Hello online edit";
    const merged = "Hello offline online edit";

    expect(
      blockNeedsConflictReview(base, mine, theirs, merged, true),
    ).toBe(true);
  });
});
