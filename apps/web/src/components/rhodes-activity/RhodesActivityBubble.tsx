import type { LucideIcon } from "lucide-react";
import { Loader } from "@/components/Loader";
import "./RhodesActivityBubble.css";

export type RhodesActivityBubbleVariant =
  | "processing"
  | "insights"
  | "properties"
  | "writing";

type RhodesActivityBubbleProps = {
  variant: RhodesActivityBubbleVariant;
  icon?: LucideIcon;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
};

export function RhodesActivityBubble({
  variant,
  icon: Icon,
  label,
  count,
  active = false,
  onClick,
}: RhodesActivityBubbleProps) {
  if (variant === "processing") {
    return (
      <div
        className="rhodes-activity-bubble rhodes-activity-bubble--processing"
        role="status"
        aria-label={label}
        title={label}
      >
        <Loader size="xs" label={label} />
      </div>
    );
  }

  const className = [
    "rhodes-activity-bubble",
    `rhodes-activity-bubble--${variant}`,
    active ? "rhodes-activity-bubble--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={count != null && count > 0 ? `${label} (${count})` : label}
      title={label}
    >
      {Icon ? <Icon size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
      {count != null && count > 0 ? (
        <span className="rhodes-activity-bubble__count">{count}</span>
      ) : null}
    </button>
  );
}
