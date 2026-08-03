"use client";

import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";
import {
  BUNDLE_CATALOG,
  bundleAllowedForTier,
  getBundlesByIds,
} from "@rhodes/shared/scope-bundles";
import {
  SYSTEM_SCOPE_TEMPLATE_CATALOG,
  getScopeTemplateLabel,
} from "@rhodes/shared/scope-template-catalog";
import { Checkbox } from "@/components/Checkbox";
import { GroupLabel } from "@/components/SectionHeader";
import { NeutralPill } from "@/components/NeutralPill";
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
    bundle.viewPresets.map((preset) => ({ bundleId: bundle.id, bundleLabel: bundle.label, preset })),
  );

  const resolvedViews = resolved.ok ? resolved.enabledViews : [];
  const hasSelectableViews = availableViews.length > 0 || bundlePresets.length > 0;

  // Bundles the user has explicitly selected — their templates/presets are locked "on"
  // elsewhere in the workspace, so those rows read as included, not independently toggleable.
  const selectedBundles = getBundlesByIds(draft.selectedBundleIds);
  const bundleLabelByTemplate = new Map<string, string>();
  for (const bundle of selectedBundles) {
    for (const slug of bundle.templateSlugs) {
      if (!bundleLabelByTemplate.has(slug)) bundleLabelByTemplate.set(slug, bundle.label);
    }
  }
  const catalogSlugs = new Set(SYSTEM_SCOPE_TEMPLATE_CATALOG.map((template) => template.slug));
  const extraBundleTemplates = [...bundleLabelByTemplate.entries()].filter(
    ([slug]) => !catalogSlugs.has(slug),
  );

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
              {bundlePresets.map(({ bundleId, bundleLabel, preset }) => {
                const lockedByBundle = draft.selectedBundleIds.includes(bundleId);
                const checked = lockedByBundle
                  ? true
                  : resolved.ok
                    ? resolved.viewPresetIds.includes(preset.id)
                    : draft.selectedViewPresetIds.includes(preset.id);
                return (
                  <li key={preset.id} className="scope-composition__option">
                    <Checkbox
                      className="scope-composition__checkbox"
                      label={preset.label}
                      description={preset.description}
                      checked={checked}
                      disabled={lockedByBundle}
                      onChange={() => onToggleViewPreset(preset.id)}
                      trailing={
                        lockedByBundle ? <NeutralPill>Via {bundleLabel}</NeutralPill> : undefined
                      }
                    />
                  </li>
                );
              })}
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
            {SYSTEM_SCOPE_TEMPLATE_CATALOG.map((template) => {
              const lockedByBundle = bundleLabelByTemplate.get(template.slug);
              const checked = lockedByBundle
                ? true
                : resolved.ok && resolved.templateSlugs.includes(template.slug);
              return (
                <li key={template.slug} className="scope-composition__option">
                  <Checkbox
                    className="scope-composition__checkbox"
                    label={template.label}
                    description={template.description}
                    checked={checked}
                    disabled={Boolean(lockedByBundle)}
                    onChange={() => onToggleTemplate(template.slug)}
                    trailing={
                      lockedByBundle ? <NeutralPill>Via {lockedByBundle}</NeutralPill> : undefined
                    }
                  />
                </li>
              );
            })}
          </ul>

          {extraBundleTemplates.length > 0 ? (
            <div className="scope-composition__group">
              <GroupLabel className="scope-composition__group-label">
                Included via bundles
              </GroupLabel>
              <ul className="scope-composition__options">
                {extraBundleTemplates.map(([slug, bundleLabel]) => (
                  <li key={slug} className="scope-composition__option">
                    <Checkbox
                      className="scope-composition__checkbox"
                      label={getScopeTemplateLabel(slug)}
                      checked
                      disabled
                      onChange={() => {}}
                      trailing={<NeutralPill>Via {bundleLabel}</NeutralPill>}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
              const includes = [
                ...bundle.viewPresets.map((preset) => preset.label),
                ...bundle.templateSlugs.map(getScopeTemplateLabel),
              ];
              return (
                <li key={bundle.id} className="scope-composition__option scope-composition__option--bundle">
                  <Checkbox
                    className="scope-composition__checkbox"
                    label={bundle.label}
                    description={bundle.description}
                    checked={draft.selectedBundleIds.includes(bundle.id)}
                    onChange={() => onToggleBundle(bundle.id)}
                  />
                  {includes.length > 0 ? (
                    <div className="scope-composition__bundle-includes">
                      {includes.map((item) => (
                        <NeutralPill key={item}>{item}</NeutralPill>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
