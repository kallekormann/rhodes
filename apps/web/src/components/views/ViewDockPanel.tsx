"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import "./ViewDockPanel.css";

type ViewDockPanelProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function ViewDockPanel({ title, onClose, children, footer }: ViewDockPanelProps) {
  return (
    <aside className="view-dock-panel">
      <header className="view-dock-panel__header">
        <h3 className="view-dock-panel__title">{title}</h3>
        <IconButton icon={X} label="Close panel" size="small" onClick={onClose} />
      </header>
      <div className="view-dock-panel__body">{children}</div>
      {footer ? <div className="view-dock-panel__footer">{footer}</div> : null}
    </aside>
  );
}

export function ViewSettingsField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="view-settings-field">
      <span className="caption view-settings-field__label">{label}</span>
      {children}
      {hint ? <span className="caption view-settings-field__hint">{hint}</span> : null}
    </label>
  );
}
