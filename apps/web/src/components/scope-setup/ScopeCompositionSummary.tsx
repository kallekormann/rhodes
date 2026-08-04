"use client";

import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";
import { getViewPresetsByIds } from "@rhodes/shared/scope-bundles";
import { getScopeTemplateLabel } from "@rhodes/shared/scope-template-catalog";
import type { ScopeCompositionOutcome } from "@rhodes/shared/scope-composition";
import "./ScopeCompositionSummary.css";

type ScopeCompositionSummaryProps = {
  resolved: ScopeCompositionOutcome;
};

function viewSummaryLabel(
  viewId: string,
  boardCount: number,
): string {
  const label =
    ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === viewId)?.label ??
    viewId;
  if (boardCount > 1) return `${label} (${boardCount} boards)`;
  if (boardCount === 1) return `${label} (1 board)`;
  return label;
}

export function ScopeCompositionSummary({
  resolved,
}: ScopeCompositionSummaryProps) {
  const presets = resolved.ok
    ? getViewPresetsByIds(resolved.viewPresetIds)
    : [];

  return (
    <section className="scope-composition-summary" aria-live="polite">
      <h3 className="scope-composition-summary__title">Summary</h3>
      {!resolved.ok ? (
        <p className="caption scope-composition-summary__error">
          {resolved.reason}
        </p>
      ) : (
        <div className="scope-composition-summary__grid">
          <div className="scope-composition-summary__block">
            <span className="scope-composition-summary__label">Views</span>
            {resolved.enabledViews.length === 0 ? (
              <p className="scope-composition-summary__empty">
                No additional views
              </p>
            ) : (
              <ul className="scope-composition-summary__list">
                {resolved.enabledViews.map((viewId) => {
                  const boardCount = presets.filter(
                    (preset) => preset.baseViewType === viewId,
                  ).length;
                  return (
                    <li key={viewId}>
                      {viewSummaryLabel(viewId, boardCount)}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="scope-composition-summary__block">
            <span className="scope-composition-summary__label">Templates</span>
            {resolved.templateSlugs.length === 0 ? (
              <p className="scope-composition-summary__empty">
                No templates selected
              </p>
            ) : (
              <ul className="scope-composition-summary__list">
                {resolved.templateSlugs.map((slug) => (
                  <li key={slug}>{getScopeTemplateLabel(slug)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
