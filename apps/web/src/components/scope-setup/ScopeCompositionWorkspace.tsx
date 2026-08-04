"use client";

import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";
import {
  BUNDLE_CATALOG,
  bundleAllowedForTier,
  getBundlesByIds,
  getViewPresetsByIds,
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
  const selectableViews = ADDITIONAL_SCOPE_VIEW_CATALOG.filter(
    (view) => view.status === "available",
  );
  const comingSoonViews = ADDITIONAL_SCOPE_VIEW_CATALOG.filter(
    (view) => view.status !== "available",
  );

  const bundlePresets = BUNDLE_CATALOG.flatMap((bundle) =>
    bundle.viewPresets.map((preset) => ({
      bundleId: bundle.id,
      bundleLabel: bundle.label,
      preset,
    })),
  );

  // Checkboxes always reflect the user's explicit picks, even when `resolved` fails
  // validation (e.g. over the plan's view limit) — otherwise every checkbox would
  // appear to clear itself the moment a limit is hit.
  const checkedViewIds = new Set(draft.selectedBaseViewIds);
  const inferredViewIds = new Set(
    resolved.ok ? resolved.inferred.addedViews : [],
  );
  const inferredTemplateSlugs = new Set(
    resolved.ok ? resolved.inferred.addedTemplates : [],
  );
  if (resolved.ok) {
    for (const id of resolved.enabledViews) checkedViewIds.add(id);
  }
  const hasPageTypeRows =
    selectableViews.length > 0 || comingSoonViews.length > 0;

  // Bundles the user has explicitly selected — their templates/presets are locked "on"
  // elsewhere in the workspace, so those rows read as included, not independently toggleable.
  const selectedBundles = getBundlesByIds(draft.selectedBundleIds);
  const bundleLabelByTemplate = new Map<string, string>();
  for (const bundle of selectedBundles) {
    for (const slug of bundle.templateSlugs) {
      if (!bundleLabelByTemplate.has(slug))
        bundleLabelByTemplate.set(slug, bundle.label);
    }
  }
  const catalogSlugs = new Set(
    SYSTEM_SCOPE_TEMPLATE_CATALOG.map((template) => template.slug),
  );
  const extraBundleTemplates = [...bundleLabelByTemplate.entries()].filter(
    ([slug]) => !catalogSlugs.has(slug),
  );

  const selectedPresetIds = resolved.ok
    ? resolved.viewPresetIds
    : draft.selectedViewPresetIds;
  const selectedPresets = getViewPresetsByIds(selectedPresetIds);

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
          {!resolved.ok ? (
            <p className="scope-composition__error" role="alert">
              {resolved.reason} Remove a view below to make room.
            </p>
          ) : null}
          <p className="scope-composition__intro">
            Each page type counts toward your plan limit. Boards and dashboards
            inside a page are tabs and are unlimited.
          </p>
          {hasPageTypeRows ? (
            <ul className="scope-composition__options">
              {selectableViews.map((view) => {
                const explicit = draft.selectedBaseViewIds.includes(view.id);
                const inferredOnly =
                  !explicit &&
                  inferredViewIds.has(view.id) &&
                  checkedViewIds.has(view.id);
                const boardCount = selectedPresets.filter(
                  (preset) => preset.baseViewType === view.id,
                ).length;
                return (
                  <li key={view.id} className="scope-composition__option">
                    <Checkbox
                      className="scope-composition__checkbox"
                      label={
                        boardCount > 1
                          ? `${view.label} (${boardCount} boards)`
                          : boardCount === 1
                            ? `${view.label} (1 board)`
                            : view.label
                      }
                      description={view.description}
                      checked={checkedViewIds.has(view.id)}
                      disabled={inferredOnly}
                      onChange={() => onToggleBaseView(view.id)}
                      trailing={
                        inferredOnly ? (
                          <NeutralPill>Enabled by your templates</NeutralPill>
                        ) : undefined
                      }
                    />
                  </li>
                );
              })}
              {comingSoonViews.map((view) => (
                <li key={view.id} className="scope-composition__option">
                  <Checkbox
                    className="scope-composition__checkbox"
                    label={view.label}
                    description={view.description}
                    checked={false}
                    disabled
                    onChange={() => {}}
                    trailing={<NeutralPill>Coming soon</NeutralPill>}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="scope-composition__empty-panel">
              You&apos;re ready to go with the essentials. More views are on the
              way.
            </p>
          )}

          {bundlePresets.length > 0 ? (
            <div className="scope-composition__group">
              <GroupLabel className="scope-composition__group-label">
                Preset boards
              </GroupLabel>
              <p className="scope-composition__intro">
                These appear as tabs on Kanban, Dashboard, and other pages —
                they do not count as extra page types.
              </p>
              <ul className="scope-composition__options">
                {bundlePresets.map(({ bundleId, bundleLabel, preset }) => {
                  const lockedByBundle =
                    draft.selectedBundleIds.includes(bundleId);
                  const checked = lockedByBundle
                    ? true
                    : resolved.ok
                      ? resolved.viewPresetIds.includes(preset.id)
                      : draft.selectedViewPresetIds.includes(preset.id);
                  const pageLabel =
                    ADDITIONAL_SCOPE_VIEW_CATALOG.find(
                      (view) => view.id === preset.baseViewType,
                    )?.label ?? preset.baseViewType;
                  return (
                    <li key={preset.id} className="scope-composition__option">
                      <Checkbox
                        className="scope-composition__checkbox"
                        label={preset.label}
                        description={`${preset.description} · Tab on ${pageLabel}`}
                        checked={checked}
                        disabled={lockedByBundle}
                        onChange={() => onToggleViewPreset(preset.id)}
                        trailing={
                          lockedByBundle ? (
                            <NeutralPill>Via {bundleLabel}</NeutralPill>
                          ) : (
                            <NeutralPill>{pageLabel} tab</NeutralPill>
                          )
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
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
              const explicit = draft.selectedTemplateSlugs.includes(
                template.slug,
              );
              const inferredOnly =
                !lockedByBundle &&
                !explicit &&
                inferredTemplateSlugs.has(template.slug) &&
                resolved.ok &&
                resolved.templateSlugs.includes(template.slug);
              const checked = lockedByBundle
                ? true
                : resolved.ok &&
                  resolved.templateSlugs.includes(template.slug);
              return (
                <li key={template.slug} className="scope-composition__option">
                  <Checkbox
                    className="scope-composition__checkbox"
                    label={template.label}
                    description={template.description}
                    checked={checked}
                    disabled={Boolean(lockedByBundle) || inferredOnly}
                    onChange={() => onToggleTemplate(template.slug)}
                    trailing={
                      lockedByBundle ? (
                        <NeutralPill>Via {lockedByBundle}</NeutralPill>
                      ) : inferredOnly ? (
                        <NeutralPill>Enabled by your views</NeutralPill>
                      ) : undefined
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
            Bundles add matched boards (as tabs) and templates together. Page
            types still count toward your plan limit.
          </p>
          <ul className="scope-composition__options">
            {BUNDLE_CATALOG.map((bundle) => {
              const allowed = bundleAllowedForTier(bundle, tier);
              if (!allowed || bundle.status !== "available") return null;
              const includes = [
                ...bundle.viewPresets.map(
                  (preset) => `${preset.label} (tab)`,
                ),
                ...bundle.templateSlugs.map(getScopeTemplateLabel),
              ];
              return (
                <li
                  key={bundle.id}
                  className="scope-composition__option scope-composition__option--bundle"
                >
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
