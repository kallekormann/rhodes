import { describe, expect, it } from "vitest";
import {
  CALENDAR_PANEL_ESTIMATED_WIDTH,
  clampPanelPosition,
  computeHorizontalAlign,
  VIEWPORT_PADDING,
} from "@/components/popoverAlign";

describe("computeHorizontalAlign", () => {
  it("flips to right when a calendar-width panel would overflow the viewport", () => {
    const trigger = {
      left: 900,
      right: 980,
      top: 40,
      bottom: 72,
      width: 80,
      height: 32,
    } as DOMRect;

    expect(
      computeHorizontalAlign(trigger, CALENDAR_PANEL_ESTIMATED_WIDTH, 1000),
    ).toBe("right");
  });
});

describe("clampPanelPosition", () => {
  it("keeps a right-edge calendar panel inside the viewport", () => {
    const clamped = clampPanelPosition({
      top: 76,
      left: 900,
      panelWidth: CALENDAR_PANEL_ESTIMATED_WIDTH,
      panelHeight: 320,
      viewportWidth: 1000,
      viewportHeight: 800,
    });

    expect(clamped.left).toBe(
      1000 - CALENDAR_PANEL_ESTIMATED_WIDTH - VIEWPORT_PADDING,
    );
    expect(clamped.left + CALENDAR_PANEL_ESTIMATED_WIDTH).toBeLessThanOrEqual(
      1000 - VIEWPORT_PADDING,
    );
  });
});
