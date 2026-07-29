"use client";

import { GroupLabel } from "@/components/SectionHeader";
import "./ScopeSettingsPanels.css";

type ScopeSettingsPlaceholderProps = {
  title: string;
  description: string;
  milestone?: string;
};

export function ScopeSettingsPlaceholder({
  title,
  description,
  milestone,
}: ScopeSettingsPlaceholderProps) {
  return (
    <div className="scope-settings-panel">
      <GroupLabel>{title}</GroupLabel>
      <p className="caption scope-settings-panel__intro">{description}</p>
      {milestone ? (
        <p className="caption scope-settings-field__hint">Planned: {milestone}</p>
      ) : null}
    </div>
  );
}
