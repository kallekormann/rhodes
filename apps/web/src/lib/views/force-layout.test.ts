import { describe, expect, it } from "vitest";
import { computeForceLayout } from "@/lib/views/force-layout";

describe("computeForceLayout", () => {
  it("assigns finite positions to every node", () => {
    const positions = computeForceLayout(
      ["a", "b", "c"],
      [{ source: "a", target: "b" }],
    );
    expect(positions.size).toBe(3);
    for (const id of ["a", "b", "c"]) {
      const point = positions.get(id);
      expect(point).toBeDefined();
      expect(Number.isFinite(point?.x)).toBe(true);
      expect(Number.isFinite(point?.y)).toBe(true);
    }
  });

  it("handles an empty graph", () => {
    expect(computeForceLayout([], []).size).toBe(0);
  });
});
