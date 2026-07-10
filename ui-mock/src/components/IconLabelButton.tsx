import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { ButtonSize } from "./Button";
import "./IconLabelButton.css";

type IconLabelVariant = "meta" | "primary" | "secondary" | "ghost" | "danger";

type IconLabelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  active?: boolean;
  variant?: IconLabelVariant;
  size?: ButtonSize;
  iconSize?: number;
  children: ReactNode;
};

export function IconLabelButton({
  icon: Icon,
  active = false,
  variant = "meta",
  size = "default",
  iconSize,
  children,
  className = "",
  ...props
}: IconLabelButtonProps) {
  const resolvedIconSize =
    iconSize ?? (variant === "meta" ? 14 : size === "small" ? 14 : 16);

  return (
    <button
      type="button"
      className={`icon-label-btn icon-label-btn--${variant} icon-label-btn--${size} ${active ? "icon-label-btn--active" : ""} ${className}`.trim()}
      {...props}
    >
      {Icon && <Icon size={resolvedIconSize} strokeWidth={1.75} />}
      <span>{children}</span>
    </button>
  );
}
