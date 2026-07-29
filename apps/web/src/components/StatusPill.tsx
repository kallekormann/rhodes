import type { LucideIcon } from "lucide-react";
import { Loader } from "@/components/Loader";
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
  /** Rhodes spinner — use for in-flight pipeline states (Queued, Indexing, Analyzing…). */
  loading?: boolean;
};

export function StatusPill({ variant, label, icon: Icon, loading }: StatusPillProps) {
  const text = label ?? labels[variant];
  return (
    <span className={`status-pill status-pill--${variant}`}>
      {loading ? (
        <Loader size="xs" label={text} className="status-pill__loader" />
      ) : Icon ? (
        <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      ) : null}
      {text}
    </span>
  );
}
