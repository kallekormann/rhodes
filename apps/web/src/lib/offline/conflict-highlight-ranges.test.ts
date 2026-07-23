import { describe, expect, it } from "vitest";
import {
  conflictCharRangesForBlock,
  conflictCharRangesInDisplayText,
  shiftCharRangesToDisplayText,
} from "@/lib/offline/conflict-highlight-ranges";

describe("conflictCharRangesForBlock", () => {
  it("highlights the diverging region in the offline row, not unrelated words", () => {
    const base = "Text in row 2 added by User B";
    const mine = "Text in row 2 changed by User A";
    const theirs = "Text in row 2 edited by User B";

    const ranges = conflictCharRangesForBlock({ baseText: base, mineText: mine, theirsText: theirs });
    expect(ranges).toEqual([{ start: 14, end: 31 }]);

    const highlighted = mine.slice(ranges[0].start, ranges[0].end);
    expect(highlighted).toBe("changed by User A");
  });

  it("does not match 'added' from another row via substring search", () => {
    const base = "Text in row 1 added by User B";
    const mine = "Text in row 1 added by User B";
    const theirs = "Text in row 1 added by User B";

    expect(
      conflictCharRangesForBlock({ baseText: base, mineText: mine, theirsText: theirs }),
    ).toEqual([]);
  });

  it("finds overlapping edit spans in garbled merged text (legacy displayText helper)", () => {
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
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it("returns empty when mine and theirs match", () => {
    const text = "Hello world";
    expect(
      conflictCharRangesForBlock({
        baseText: text,
        mineText: text,
        theirsText: text,
      }),
    ).toEqual([]);
  });
});

describe("shiftCharRangesToDisplayText", () => {
  it("offsets ranges when snapshot text was trimmed", () => {
    const ranges = [{ start: 0, end: 5 }];
    expect(shiftCharRangesToDisplayText(ranges, "hello", "  hello  ")).toEqual([
      { start: 2, end: 7 },
    ]);
  });
});
