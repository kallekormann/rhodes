import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import type { ButtonSize } from "./Button";
import "./Button.css";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  size?: ButtonSize;
  iconSize?: number;
};

export function IconButton({
  icon: Icon,
  label,
  active = false,
  size = "default",
  iconSize,
  className = "",
  ...props
}: IconButtonProps) {
  const resolvedIconSize = iconSize ?? (size === "small" ? 16 : 20);

  return (
    <button
      type="button"
      className={`icon-btn icon-btn--${size} ${active ? "icon-btn--active" : ""} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={resolvedIconSize} strokeWidth={1.75} />
    </button>
  );
}
