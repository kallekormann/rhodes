"use client";

import type { ReactNode } from "react";
import {
  Calendar,
  Columns3,
  Files,
  GanttChart,
  LayoutDashboard,
  Network,
  Workflow,
} from "lucide-react";
import { Dropdown } from "@/components/Dropdown";
import {
  DOCUMENTS_SCOPE_NAV_VIEW,
  type ScopeNavView,
} from "@/lib/scope-views/nav";
import "./ScopeViewNav.css";

type ScopeViewNavProps = {
  views: ScopeNavView[];
  activeViewId: string;
  onChange: (viewId: string) => void;
};

const VIEW_ICON_COMPONENTS: Record<
  string,
  typeof Files
> = {
  documents: Files,
  kanban: Columns3,
  dashboard: LayoutDashboard,
  calendar: Calendar,
  gantt: GanttChart,
  mindmap: Workflow,
  graph: Network,
};

function viewIcon(viewId: string, size: number): ReactNode {
  const Icon = VIEW_ICON_COMPONENTS[viewId] ?? Files;
  return <Icon size={size} strokeWidth={1.75} />;
}

export function ScopeViewNav({ views, activeViewId, onChange }: ScopeViewNavProps) {
  const activeView =
    views.find((view) => view.id === activeViewId) ?? DOCUMENTS_SCOPE_NAV_VIEW;

  if (views.length <= 1) {
    return (
      <button
        type="button"
        className="nav-link nav-link--active scope-view-nav scope-view-nav--single"
        onClick={() => onChange(DOCUMENTS_SCOPE_NAV_VIEW.id)}
      >
        {viewIcon(activeView.id, 18)}
        <span className="nav-link__label">{activeView.label}</span>
      </button>
    );
  }

  return (
    <Dropdown
      className="scope-view-nav"
      variant="menu"
      trigger={activeView.label}
      options={views.map((view) => ({
        id: view.id,
        label: view.label,
        icon: viewIcon(view.id, 16),
      }))}
      value={activeViewId}
      onChange={onChange}
      aria-label="Scope view"
    />
  );
}
