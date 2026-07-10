export type HorizontalAlign = "left" | "right";

const VIEWPORT_PADDING = 8;

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
