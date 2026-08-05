"use client";

import type { LucideIcon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import "./ViewEmptyState.css";

export type ViewEmptyStateAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type ViewEmptyStateProps = {
  /** Prefer omitting — icons read as marketing empty states. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  hint?: string;
  primaryAction?: ViewEmptyStateAction;
  secondaryAction?: ViewEmptyStateAction;
  /**
   * `inline` — list / toolbar contexts (default): left-aligned, caption scale.
   * `panel` — full canvas views: gently centered, still quiet.
   */
  layout?: "inline" | "panel";
  className?: string;
};

/**
 * Quiet empty / first-run surface. Sits in the content rhythm like Rhodes captions —
 * not a centered marketing block.
 */
export function ViewEmptyState({
  icon: Icon,
  title,
  description,
  hint,
  primaryAction,
  secondaryAction,
  layout = "inline",
  className = "",
}: ViewEmptyStateProps) {
  return (
    <div
      className={`view-empty-state view-empty-state--${layout}${className ? ` ${className}` : ""}`}
      role="status"
    >
      <div className="view-empty-state__copy">
        {Icon ? (
          <Icon size={16} strokeWidth={1.75} className="view-empty-state__icon" aria-hidden />
        ) : null}
        <p className="view-empty-state__title">{title}</p>
        {description ? (
          <p className="view-empty-state__description">{description}</p>
        ) : null}
        {hint ? <p className="view-empty-state__hint">{hint}</p> : null}
      </div>
      {primaryAction || secondaryAction ? (
        <div className="view-empty-state__actions">
          {primaryAction ? (
            <NavLink
              size="small"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </NavLink>
          ) : null}
          {secondaryAction ? (
            <NavLink
              size="small"
              disabled={secondaryAction.disabled}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </NavLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
