"use client";

type ScopeSettingsPlaceholderProps = {
  description: string;
  milestone?: string;
};

export function ScopeSettingsPlaceholder({
  description,
  milestone,
}: ScopeSettingsPlaceholderProps) {
  return (
    <>
      <p className="caption settings-section__intro">{description}</p>
      {milestone ? (
        <p className="caption settings-field__hint">Planned: {milestone}</p>
      ) : null}
    </>
  );
}
