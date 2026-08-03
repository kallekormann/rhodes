"use client";

import { Files } from "lucide-react";
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
        <Files size={18} strokeWidth={1.75} />
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
        icon: view.id === DOCUMENTS_SCOPE_NAV_VIEW.id ? (
          <Files size={16} strokeWidth={1.75} />
        ) : undefined,
      }))}
      value={activeViewId}
      onChange={onChange}
      aria-label="Scope view"
    />
  );
}
