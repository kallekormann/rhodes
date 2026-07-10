import type { LucideIcon } from "lucide-react";
import "./StatusPill.css";

type StatusVariant = "success" | "warning" | "error" | "info" | "draft" | "progress";

const labels: Record<StatusVariant, string> = {
  success: "Ready",
  warning: "Warning",
  error: "Error",
  info: "Info",
  draft: "Draft",
  progress: "In progress",
};

type StatusPillProps = {
  variant: StatusVariant;
  label?: string;
  icon?: LucideIcon;
};

export function StatusPill({ variant, label, icon: Icon }: StatusPillProps) {
  return (
    <span className={`status-pill status-pill--${variant}`}>
      {Icon && <Icon size={14} strokeWidth={1.75} />}
      {label ?? labels[variant]}
    </span>
  );
}
