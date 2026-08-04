"use client";

import { ViewDockPanel } from "@/components/views/ViewDockPanel";

type ViewInfoPanelProps = {
  description: string;
  setupSteps: string[];
  actions: string[];
  warnings?: string[];
  onClose: () => void;
};

export function ViewInfoPanel({
  description,
  setupSteps,
  actions,
  warnings = [],
  onClose,
}: ViewInfoPanelProps) {
  return (
    <ViewDockPanel title="About this view" onClose={onClose}>
      {warnings.length > 0 ? (
        <div className="view-info-panel__warnings" role="status">
          {warnings.map((warning) => (
            <p key={warning} className="view-info-panel__warning">
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <p className="view-info-panel__description">{description}</p>

      <div>
        <h4 className="view-info-panel__section-title">How to set it up</h4>
        <ol className="view-info-panel__list">
          {setupSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div>
        <h4 className="view-info-panel__section-title">What you can do here</h4>
        <ul className="view-info-panel__list">
          {actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </div>
    </ViewDockPanel>
  );
}
