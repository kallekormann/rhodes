"use client";

import { Check } from "lucide-react";
import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";
import { BUNDLE_CATALOG, bundleAllowedForTier } from "@rhodes/shared/scope-bundles";
import { SYSTEM_SCOPE_TEMPLATE_CATALOG } from "@rhodes/shared/scope-template-catalog";
import { Checkbox } from "@/components/Checkbox";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { ScopeCompositionDraft } from "@/hooks/useScopeCompositionDraft";
import "./ScopeCompositionWorkspace.css";

type CompositionTab = "views" | "templates" | "bundles";

type ScopeCompositionWorkspaceProps = {
  draft: ScopeCompositionDraft;
  resolved: import("@rhodes/shared/scope-composition").ScopeCompositionOutcome;
  tier: import("@rhodes/shared/tiers").BillingTier;
  tab: CompositionTab;
  onTabChange: (tab: CompositionTab) => void;
  onToggleBaseView: (viewId: string) => void;
  onToggleViewPreset: (presetId: string) => void;
  onToggleTemplate: (slug: string) => void;
  onToggleBundle: (bundleId: string) => void;
};

export function ScopeCompositionWorkspace({
  draft,
  resolved,
  tier,
  tab,
  onTabChange,
  onToggleBaseView,
  onToggleViewPreset,
  onToggleTemplate,
  onToggleBundle,
}: ScopeCompositionWorkspaceProps) {
  const availableViews = ADDITIONAL_SCOPE_VIEW_CATALOG.filter(
    (view) => view.status === "available",
  );
  const comingSoonViewCount = ADDITIONAL_SCOPE_VIEW_CATALOG.filter(
    (view) => view.status !== "available",
  ).length;

  const bundlePresets = BUNDLE_CATALOG.flatMap((bundle) =>
    bundle.viewPresets.map((preset) => ({ bundleId: bundle.id, preset })),
  );

  const resolvedViews = resolved.ok ? resolved.enabledViews : [];
  const hasSelectableViews = availableViews.length > 0 || bundlePresets.length > 0;

  return (
    <div className="scope-composition">
      <SegmentedControl
        options={[
          { value: "views", label: "Views" },
          { value: "templates", label: "Templates" },
          { value: "bundles", label: "Bundles" },
        ]}
        value={tab}
        onChange={onTabChange}
      />

      {tab === "views" && (
        <>
          {hasSelectableViews ? (
            <ul className="scope-composition__options">
              {availableViews.map((view) => (
                <li key={view.id} className="scope-composition__option">
                  <Checkbox
                    className="scope-composition__checkbox"
                    label={view.label}
                    description={view.description}
                    checked={resolvedViews.includes(view.id)}
                    onChange={() => onToggleBaseView(view.id)}
                  />
                </li>
              ))}
              {bundlePresets.map(({ preset }) => (
                <li key={preset.id} className="scope-composition__option">
                  <Checkbox
                    className="scope-composition__checkbox"
                    label={preset.label}
                    description={preset.description}
                    checked={draft.selectedViewPresetIds.includes(preset.id)}
                    onChange={() => onToggleViewPreset(preset.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="scope-composition__empty-panel">
              You&apos;re ready to go with the essentials. More views are on the way.
            </p>
          )}
          {comingSoonViewCount > 0 ? (
            <p className="scope-composition__footnote">
              More views like Kanban and Calendar are coming soon.
            </p>
          ) : null}
        </>
      )}

      {tab === "templates" && (
        <>
          <p className="scope-composition__intro">
            Choose templates for new documents in this scope.
          </p>
          <ul className="scope-composition__options">
            {SYSTEM_SCOPE_TEMPLATE_CATALOG.map((template) => (
              <li key={template.slug} className="scope-composition__option">
                <Checkbox
                  className="scope-composition__checkbox"
                  label={template.label}
                  description={template.description}
                  checked={
                    resolved.ok ? resolved.templateSlugs.includes(template.slug) : false
                  }
                  onChange={() => onToggleTemplate(template.slug)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "bundles" && (
        <>
          <p className="scope-composition__intro">
            Bundles add matched views and templates together.
          </p>
          <ul className="scope-composition__options">
            {BUNDLE_CATALOG.map((bundle) => {
              const allowed = bundleAllowedForTier(bundle, tier);
              if (!allowed || bundle.status !== "available") return null;
              return (
                <li key={bundle.id} className="scope-composition__option">
                  <Checkbox
                    className="scope-composition__checkbox"
                    label={bundle.label}
                    description={bundle.description}
                    checked={draft.selectedBundleIds.includes(bundle.id)}
                    onChange={() => onToggleBundle(bundle.id)}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
