import type { ReactNode } from "react";
import "./WizardOutline.css";

export const WIZARD_OUTLINE_PREVIEW_LIMIT = 5;

type TruncatedListProps = {
  items: string[];
  limit?: number;
  className?: string;
};

export function TruncatedList({
  items,
  limit = WIZARD_OUTLINE_PREVIEW_LIMIT,
  className = "wizard-outline__list",
}: TruncatedListProps) {
  if (items.length === 0) return null;

  const visible = items.slice(0, limit);
  const overflow = items.length - limit;

  return (
    <ul className={className}>
      {visible.map((item) => (
        <li key={item}>{item}</li>
      ))}
      {overflow > 0 ? <li className="wizard-outline__more">{overflow} more…</li> : null}
    </ul>
  );
}

type WizardOutlineProps = {
  contextTitle?: string;
  contextLead?: string;
  preview?: ReactNode;
  children: ReactNode;
};

export function WizardOutline({
  contextTitle,
  contextLead,
  preview,
  children,
}: WizardOutlineProps) {
  const showContext = Boolean(contextTitle || contextLead);

  return (
    <aside className="wizard-outline" aria-label="Scope preview">
      {showContext ? (
        <div className="wizard-outline__context">
          {contextTitle ? (
            <h3 className="wizard-outline__context-title">{contextTitle}</h3>
          ) : null}
          {contextLead ? (
            <p className="wizard-outline__context-lead">{contextLead}</p>
          ) : null}
        </div>
      ) : null}
      {preview}
      <div className="wizard-outline__details">{children}</div>
    </aside>
  );
}

type WizardOutlineDetailProps = {
  label: string;
  active?: boolean;
  empty?: string;
  children?: ReactNode;
};

export function WizardOutlineDetail({
  label,
  active = false,
  empty,
  children,
}: WizardOutlineDetailProps) {
  const hasContent = Boolean(children);

  return (
    <div
      className={`wizard-outline__detail${active ? " wizard-outline__detail--active" : ""}`}
    >
      <dt className="wizard-outline__detail-term">{label}</dt>
      {hasContent ? (
        <dd className="wizard-outline__detail-value">{children}</dd>
      ) : empty ? (
        <dd className="wizard-outline__detail-value wizard-outline__detail-value--empty">
          {empty}
        </dd>
      ) : null}
    </div>
  );
}

/** @deprecated Use WizardOutlineDetail */
export function WizardOutlineSection({
  label,
  active = false,
  empty,
  children,
}: WizardOutlineDetailProps) {
  return (
    <WizardOutlineDetail label={label} active={active} empty={empty}>
      {children}
    </WizardOutlineDetail>
  );
}
