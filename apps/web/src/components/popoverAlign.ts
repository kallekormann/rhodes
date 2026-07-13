export type HorizontalAlign = "left" | "right";

export const VIEWPORT_PADDING = 8;

export type VerticalPlacement = "above" | "below";

export const FIELD_PANEL_ESTIMATED_HEIGHT = 248;

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
