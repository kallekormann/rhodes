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

type ScopeViewsSettingsProps = {
  scopeName: string;
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
  scopeName,
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
    <>
      {!canEdit ? (
        <p className="caption settings-field__hint">
          You can view enabled views for {scopeName}. Only scope admins can change them.
        </p>
      ) : null}

      <GroupLabel>Built-in views</GroupLabel>
      <p className="caption settings-field__hint">
        These views are always available in every scope.
      </p>
      <ul className="settings-scope-views__essential">
        {ESSENTIAL_SCOPE_VIEW_IDS.map((id) => (
          <li key={id}>{essentialLabels[id] ?? id}</li>
        ))}
      </ul>

      <GroupLabel>Additional views</GroupLabel>
      <p className="caption settings-field__hint">
        Optional surfaces for {scopeName}. Your plan allows {maxAdditional} additional
        {maxAdditional === 1 ? " view" : " views"}.
      </p>

      <div className="settings-scope-views__list">
        {ADDITIONAL_SCOPE_VIEW_CATALOG.map((view) => {
          const allowed = additionalScopeViewAllowedForTier(view, tier);
          const checked = selectedAdditional.includes(view.id);
          const disabled =
            !canEdit ||
            !allowed ||
            view.status === "coming_soon" ||
            (!checked && selectedAdditional.length >= maxAdditional);

          return (
            <div key={view.id} className="settings-scope-views__row">
              <Toggle
                label={view.label}
                checked={checked}
                disabled={disabled}
                onChange={(e) => toggleView(view.id, e.target.checked)}
              />
              <p className="caption settings-field__hint">
                {view.description}
                {view.status === "coming_soon" ? " · Coming soon" : ""}
                {!allowed && view.minTier ? ` · Requires ${view.minTier}` : ""}
              </p>
            </div>
          );
        })}
      </div>

      {saving ? <p className="caption settings-field__hint">Saving…</p> : null}
    </>
  );
}
