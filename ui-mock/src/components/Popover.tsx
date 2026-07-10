import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { computeHorizontalAlign, type HorizontalAlign } from "./popoverAlign";
import "./Popover.css";

export type PopoverPosition = "top" | "right" | "bottom" | "left";
export type PopoverSize = "sm" | "md" | "lg";

type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  position?: PopoverPosition;
  size?: PopoverSize;
  className?: string;
};

export function Popover({
  trigger,
  children,
  position = "bottom",
  size = "md",
  className = "",
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [hAlign, setHAlign] = useState<HorizontalAlign>("left");
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
    if (!open || (position !== "top" && position !== "bottom")) return;

    const updateAlign = () => {
      const root = rootRef.current;
      const panel = panelRef.current;
      if (!root || !panel) return;

      const triggerRect = root.getBoundingClientRect();
      setHAlign(computeHorizontalAlign(triggerRect, panel.offsetWidth));
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
  }, [open, position]);

  const alignClass =
    position === "top" || position === "bottom"
      ? `popover--align-${hAlign}`
      : "";

  return (
    <div className={`popover-anchor ${className}`.trim()} ref={rootRef}>
      <div className="popover-anchor__trigger" onClick={() => setOpen((v) => !v)}>
        {trigger}
      </div>
      {open && (
        <div
          ref={panelRef}
          className={`popover popover--${position} popover--${size} ${alignClass}`.trim()}
          role="tooltip"
        >
          {children}
        </div>
      )}
    </div>
  );
}
