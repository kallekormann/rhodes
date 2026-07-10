import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { computeHorizontalAlign, type HorizontalAlign } from "./popoverAlign";
import "./FieldControl.css";

export function useFieldPanel() {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<HorizontalAlign>("left");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
    if (!open) return;

    const updateAlign = () => {
      const root = rootRef.current;
      const panel = panelRef.current;
      if (!root) return;

      const triggerRect = root.getBoundingClientRect();
      const panelWidth = panel?.offsetWidth ?? root.offsetWidth;
      setAlign(computeHorizontalAlign(triggerRect, panelWidth));
    };

    updateAlign();
    const frame = requestAnimationFrame(updateAlign);

    window.addEventListener("resize", updateAlign);
    window.addEventListener("scroll", updateAlign, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateAlign);
      window.removeEventListener("scroll", updateAlign, true);
    };
  }, [open]);

  return { open, setOpen, rootRef, panelRef, align };
}

type FieldPanelProps = {
  children: ReactNode;
  align?: HorizontalAlign;
  calendar?: boolean;
  className?: string;
};

export const FieldPanel = forwardRef<HTMLDivElement, FieldPanelProps>(function FieldPanel(
  { children, align = "left", calendar = false, className = "" },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`field-panel ${align === "right" ? "field-panel--align-right" : ""} ${calendar ? "field-panel--calendar" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
});
