"use client";

import type { ReactNode } from "react";
import { Info, Settings } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import "./ViewDockPanel.css";

export type ViewPanelMode = "settings" | "info" | null;

type ViewHeaderActionsProps = {
  panel: ViewPanelMode;
  onPanelChange: (panel: ViewPanelMode) => void;
  canEditSettings?: boolean;
  extra?: ReactNode;
};

export function ViewHeaderActions({
  panel,
  onPanelChange,
  canEditSettings = true,
  extra,
}: ViewHeaderActionsProps) {
  const toggle = (next: Exclude<ViewPanelMode, null>) => {
    onPanelChange(panel === next ? null : next);
  };

  return (
    <div className="view-header-actions">
      {extra ? <div className="view-header-actions__extra">{extra}</div> : null}
      <div className="view-header-actions__chrome">
        {canEditSettings ? (
          <IconButton
            icon={Settings}
            label="View settings"
            active={panel === "settings"}
            onClick={() => toggle("settings")}
          />
        ) : null}
        <IconButton
          icon={Info}
          label="About this view"
          active={panel === "info"}
          onClick={() => toggle("info")}
        />
      </div>
    </div>
  );
}
