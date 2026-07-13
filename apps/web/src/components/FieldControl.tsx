import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  computeHorizontalAlign,
  computeVerticalPlacement,
  FIELD_PANEL_ESTIMATED_HEIGHT,
  VIEWPORT_PADDING,
  type HorizontalAlign,
  type VerticalPlacement,
} from "./popoverAlign";
import "./FieldControl.css";

export type FieldPanelCoords = {
  top: number;
  left: number;
  minWidth: number;
};

function measurePanelCoords(
  root: HTMLElement,
  panel: HTMLElement | null,
): FieldPanelCoords & { align: HorizontalAlign; placement: VerticalPlacement } {
  const triggerRect = root.getBoundingClientRect();
  const panelWidth = Math.min(Math.max(triggerRect.width, 120), 320);
  const panelHeight = panel?.offsetHeight ?? FIELD_PANEL_ESTIMATED_HEIGHT;
  const align = computeHorizontalAlign(triggerRect, panelWidth);
  const placement = computeVerticalPlacement(triggerRect, panelHeight);

  const top =
    placement === "below"
      ? triggerRect.bottom + 4
      : triggerRect.top - panelHeight - 4;
  const left = align === "left" ? triggerRect.left : triggerRect.right - panelWidth;

  const clampedLeft = Math.max(
    VIEWPORT_PADDING,
    Math.min(left, window.innerWidth - panelWidth - VIEWPORT_PADDING),
  );
  const clampedTop = Math.max(
    VIEWPORT_PADDING,
    Math.min(top, window.innerHeight - panelHeight - VIEWPORT_PADDING),
  );

  return {
    top: clampedTop,
    left: clampedLeft,
    minWidth: panelWidth,
    align,
    placement,
  };
}

export function useFieldPanel() {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<HorizontalAlign>("left");
  const [placement, setPlacement] = useState<VerticalPlacement>("below");
  const [panelCoords, setPanelCoords] = useState<FieldPanelCoords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelCoords(null);
      return;
    }

    const updatePosition = () => {
      const root = rootRef.current;
      if (!root) return;

      const measured = measurePanelCoords(root, panelRef.current);
      setAlign(measured.align);
      setPlacement(measured.placement);
      setPanelCoords({
        top: measured.top,
        left: measured.left,
        minWidth: measured.minWidth,
      });
    };

    updatePosition();
    const frame = requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return { open, setOpen, rootRef, panelRef, align, placement, panelCoords };
}

type FieldPanelProps = {
  children: ReactNode;
  align?: HorizontalAlign;
  placement?: VerticalPlacement;
  calendar?: boolean;
  className?: string;
  coords?: FieldPanelCoords | null;
};

export const FieldPanel = forwardRef<HTMLDivElement, FieldPanelProps>(function FieldPanel(
  { children, align = "left", placement = "below", calendar = false, className = "", coords },
  ref,
) {
  const panelClassName = [
    "field-panel",
    "field-panel--portal",
    placement === "above" ? "field-panel--above" : "",
    align === "right" ? "field-panel--align-right" : "",
    calendar ? "field-panel--calendar" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const style: CSSProperties | undefined = coords
    ? calendar
      ? {
          position: "fixed",
          top: coords.top,
          left: coords.left,
          zIndex: 1200,
        }
      : {
          position: "fixed",
          top: coords.top,
          left: coords.left,
          width: coords.minWidth,
          zIndex: 1200,
        }
    : {
        position: "fixed",
        top: -9999,
        left: 0,
        visibility: "hidden",
        pointerEvents: "none",
        width: 160,
        zIndex: -1,
      };

  const panel = (
    <div ref={ref} className={panelClassName} style={style}>
      {children}
    </div>
  );

  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
});
