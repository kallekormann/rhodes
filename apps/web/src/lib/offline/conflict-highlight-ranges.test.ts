import { describe, expect, it } from "vitest";
import { conflictCharRangesInDisplayText } from "@/lib/offline/conflict-highlight-ranges";

describe("conflictCharRangesInDisplayText", () => {
  it("finds overlapping edit spans in garbled merged text", () => {
    const base = "Lets add other big same content";
    const mine = "Lets add other big HELLO FROM OFFLINE content";
    const theirs = "Lets add other big HELLO FROM ONLINE content";
    const display = "Lets add other big HELLOELLO FROM ONLINE FORM OFFLINE content";

    const ranges = conflictCharRangesInDisplayText({
      baseText: base,
      mineText: mine,
      theirsText: theirs,
      displayText: display,
    });

    expect(ranges.length).toBeGreaterThan(0);
    const highlighted = ranges
      .map((range) => display.slice(range.start, range.end))
      .join("");
    expect(highlighted).toMatch(/OFFLINE|ONLINE|HELLO/);
  });

  it("returns empty when mine and theirs match", () => {
    const text = "Hello world";
    expect(
      conflictCharRangesInDisplayText({
        baseText: text,
        mineText: text,
        theirsText: text,
        displayText: text,
      }),
    ).toEqual([]);
  });
});
