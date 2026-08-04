export type HorizontalAlign = "left" | "right";

export const VIEWPORT_PADDING = 8;

export type VerticalPlacement = "above" | "below";

export const FIELD_PANEL_ESTIMATED_HEIGHT = 248;

/** DatePicker / DateRangePicker content width (see DatePicker.css). */
export const CALENDAR_PANEL_ESTIMATED_WIDTH = 280;

export const CALENDAR_PANEL_ESTIMATED_HEIGHT = 320;

export function computeVerticalPlacement(
  triggerRect: DOMRect,
  panelHeight = FIELD_PANEL_ESTIMATED_HEIGHT,
  viewportHeight = window.innerHeight,
): VerticalPlacement {
  const spaceBelow = viewportHeight - VIEWPORT_PADDING - triggerRect.bottom;
  const spaceAbove = triggerRect.top - VIEWPORT_PADDING;

  if (spaceBelow >= panelHeight) return "below";
  if (spaceAbove >= panelHeight) return "above";
  return spaceBelow >= spaceAbove ? "below" : "above";
}

export function computeHorizontalAlign(
  triggerRect: DOMRect,
  panelWidth: number,
  viewportWidth = window.innerWidth,
): HorizontalAlign {
  const spaceRight = viewportWidth - VIEWPORT_PADDING - triggerRect.left;
  const spaceLeft = triggerRect.right - VIEWPORT_PADDING;

  const fitsLeft = panelWidth <= spaceRight;
  const fitsRight = panelWidth <= spaceLeft;

  if (fitsLeft) return "left";
  if (fitsRight) return "right";
  return spaceRight >= spaceLeft ? "left" : "right";
}

/** Clamp a fixed-position panel into the viewport with padding. */
export function clampPanelPosition(input: {
  top: number;
  left: number;
  panelWidth: number;
  panelHeight: number;
  viewportWidth?: number;
  viewportHeight?: number;
}): { top: number; left: number } {
  const viewportWidth = input.viewportWidth ?? window.innerWidth;
  const viewportHeight = input.viewportHeight ?? window.innerHeight;
  const maxLeft = Math.max(
    VIEWPORT_PADDING,
    viewportWidth - input.panelWidth - VIEWPORT_PADDING,
  );
  const maxTop = Math.max(
    VIEWPORT_PADDING,
    viewportHeight - input.panelHeight - VIEWPORT_PADDING,
  );

  return {
    left: Math.min(Math.max(input.left, VIEWPORT_PADDING), maxLeft),
    top: Math.min(Math.max(input.top, VIEWPORT_PADDING), maxTop),
  };
}
