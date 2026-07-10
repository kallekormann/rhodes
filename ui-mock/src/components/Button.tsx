import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LoaderCircle } from "lucide-react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "default" | "small";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "default",
  icon: Icon,
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const iconSize = size === "small" ? 14 : 16;

  return (
    <button
      type="button"
      className={`btn btn--${variant} btn--${size} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <LoaderCircle className="btn__loader" size={iconSize} strokeWidth={1.75} />
      )}
      {!loading && Icon && <Icon size={iconSize} strokeWidth={1.75} />}
      <span className={loading ? "btn__label--loading" : ""}>{children}</span>
    </button>
  );
}
