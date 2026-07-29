"use client";

import { GroupLabel } from "@/components/SectionHeader";
import { Toggle } from "@/components/Toggle";
import {
  ADDITIONAL_SCOPE_VIEW_CATALOG,
  ESSENTIAL_SCOPE_VIEW_IDS,
  additionalScopeViewAllowedForTier,
  maxAdditionalScopeViewsForTier,
} from "@rhodes/shared/scope-views";
import { buildFeatureGates } from "@/lib/features/gates";
import "./ScopeSettingsPanels.css";

type ScopeViewsSettingsProps = {
  enabledViews: string[];
  canEdit: boolean;
  saving: boolean;
  onSave: (views: string[]) => void;
};

const essentialLabels: Record<string, string> = {
  documents: "Documents",
  editor: "Editor",
  templates: "Templates",
  library: "Library",
  settings: "Settings",
};

export function ScopeViewsSettings({
  enabledViews,
  canEdit,
  saving,
  onSave,
}: ScopeViewsSettingsProps) {
  const { tier } = buildFeatureGates({});
  const maxAdditional = maxAdditionalScopeViewsForTier(tier);
  const selectedAdditional = enabledViews.filter(
    (id) => !ESSENTIAL_SCOPE_VIEW_IDS.includes(id as (typeof ESSENTIAL_SCOPE_VIEW_IDS)[number]),
  );

  const toggleView = (viewId: string, checked: boolean) => {
    const next = checked
      ? [...selectedAdditional, viewId]
      : selectedAdditional.filter((id) => id !== viewId);
    if (next.length > maxAdditional) return;
    void onSave(next);
  };

  return (
    <div className="scope-settings-panel">
      <GroupLabel>Views</GroupLabel>
      <p className="caption scope-settings-panel__intro">
        Essential views are always enabled. Additional views unlock when their
        surfaces ship (M6).
      </p>

      <div className="scope-settings-field">
        <p className="scope-settings-field__label">Always on</p>
        <ul className="scope-settings-essential-list">
          {ESSENTIAL_SCOPE_VIEW_IDS.map((id) => (
            <li key={id}>{essentialLabels[id] ?? id}</li>
          ))}
        </ul>
      </div>

      <div className="scope-settings-field">
        <p className="scope-settings-field__label">
          Additional views ({selectedAdditional.length} / {maxAdditional})
        </p>
        {!canEdit ? (
          <p className="caption scope-settings-field__hint">
            Only scope admins can change views.
          </p>
        ) : null}
        <div className="scope-settings-view-list">
          {ADDITIONAL_SCOPE_VIEW_CATALOG.map((view) => {
            const allowed = additionalScopeViewAllowedForTier(view, tier);
            const checked = selectedAdditional.includes(view.id);
            const disabled =
              !canEdit ||
              !allowed ||
              view.status === "coming_soon" ||
              (!checked && selectedAdditional.length >= maxAdditional);

            return (
              <div key={view.id} className="scope-settings-view-row">
                <Toggle
                  label={view.label}
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => toggleView(view.id, e.target.checked)}
                />
                <p className="caption scope-settings-field__hint">
                  {view.description}
                  {view.status === "coming_soon" ? " · Coming soon" : ""}
                  {!allowed && view.minTier ? ` · Requires ${view.minTier}` : ""}
                </p>
              </div>
            );
          })}
        </div>
        {saving ? (
          <p className="caption scope-settings-field__hint">Saving…</p>
        ) : null}
      </div>
    </div>
  );
}
