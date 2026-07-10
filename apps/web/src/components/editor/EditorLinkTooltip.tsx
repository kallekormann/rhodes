"use client";

import { useEffect, useRef, useState } from "react";
import "./EditorLinkTooltip.css";

type TooltipState = {
  text: string;
  href: string;
  top: number;
  left: number;
};

type EditorLinkTooltipProps = {
  containerRef: React.RefObject<HTMLElement | null>;
};

export function EditorLinkTooltip({ containerRef }: EditorLinkTooltipProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const showForLink = (anchor: HTMLAnchorElement, x: number, y: number) => {
      const kind = anchor.getAttribute("data-link-kind");
      const label = anchor.getAttribute("data-link-label");
      const href = anchor.getAttribute("href") ?? "";
      const text =
        kind === "internal" && label
          ? `Open document: ${label}`
          : `Open link: ${href}`;

      activeLinkRef.current = anchor;
      setTooltip({
        text,
        href,
        top: y - 10,
        left: x,
      });
    };

    const onMouseOver = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || !container.contains(anchor)) {
        return;
      }
      showForLink(anchor, event.clientX, event.clientY);
    };

    const onMouseOut = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const anchor = target.closest("a[href]");
      if (!anchor || anchor !== activeLinkRef.current) return;

      const related = event.relatedTarget;
      if (
        related instanceof HTMLElement &&
        related.closest(".editor-link-tooltip")
      ) {
        return;
      }

      activeLinkRef.current = null;
      setTooltip(null);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || !container.contains(anchor)) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href) return;

      event.preventDefault();
      event.stopPropagation();
      window.open(href, "_blank", "noopener,noreferrer");
    };

    container.addEventListener("mouseover", onMouseOver);
    container.addEventListener("mouseout", onMouseOut);
    container.addEventListener("click", onClick, true);

    return () => {
      container.removeEventListener("mouseover", onMouseOver);
      container.removeEventListener("mouseout", onMouseOut);
      container.removeEventListener("click", onClick, true);
    };
  }, [containerRef]);

  if (!tooltip) return null;

  return (
    <div
      className="editor-link-tooltip"
      style={{
        position: "fixed",
        top: tooltip.top,
        left: tooltip.left,
        transform: "translate(-50%, -100%)",
        zIndex: 60,
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        className="editor-link-tooltip__button"
        onClick={() => {
          window.open(tooltip.href, "_blank", "noopener,noreferrer");
        }}
      >
        {tooltip.text}
      </button>
    </div>
  );
}
