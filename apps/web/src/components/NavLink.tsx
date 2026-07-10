import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import "./NavLink.css";

export type NavLinkSize = "default" | "small";

type NavLinkProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: NavLinkSize;
  icon?: LucideIcon;
  children: ReactNode;
};

export function NavLink({
  size = "default",
  icon: Icon,
  children,
  className = "",
  ...props
}: NavLinkProps) {
  const iconSize = size === "small" ? 14 : 16;

  return (
    <button
      type="button"
      className={`nav-link-inline nav-link-inline--${size} ${className}`.trim()}
      {...props}
    >
      {Icon && <Icon size={iconSize} strokeWidth={1.75} />}
      <span>{children}</span>
    </button>
  );
}
