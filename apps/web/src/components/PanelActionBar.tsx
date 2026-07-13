import type { ReactNode } from "react";
import "./PanelActionBar.css";

type PanelActionBarProps = {
  start?: ReactNode;
  end?: ReactNode;
  className?: string;
};

export function PanelActionBar({ start, end, className = "" }: PanelActionBarProps) {
  return (
    <div className={`panel-action-bar ${className}`.trim()}>
      <div className="panel-action-bar__start">{start}</div>
      <div className="panel-action-bar__end">{end}</div>
    </div>
  );
}
