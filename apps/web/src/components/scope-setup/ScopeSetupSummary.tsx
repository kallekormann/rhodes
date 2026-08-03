"use client";

import { getScopeTemplateLabel } from "@rhodes/shared/scope-template-catalog";
import type { ScopeCompositionOutcome } from "@rhodes/shared/scope-composition";
import type { InviteRow } from "@/components/scope-setup/ScopeTeamInviteStep";
import { resolvedInvites } from "@/lib/scope-setup/invites";
import { scopePreviewViewLabels } from "@/lib/scope-composition/preview";
import type { ReactNode } from "react";
import "./ScopeSetupSummary.css";

type ScopeSetupSummaryProps = {
  scopeName: string;
  scopeKind?: "personal" | "team";
  resolved: ScopeCompositionOutcome;
  inviteRows: InviteRow[];
  showMembers?: boolean;
};

function SummaryBlock({
  label,
  empty,
  children,
}: {
  label: string;
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <section className="scope-setup-summary__block">
      <h4 className="scope-setup-summary__label">{label}</h4>
      {children ? (
        <div className="scope-setup-summary__content">{children}</div>
      ) : empty ? (
        <p className="scope-setup-summary__empty">{empty}</p>
      ) : null}
    </section>
  );
}

export function ScopeSetupSummary({
  scopeName,
  resolved,
  inviteRows,
  showMembers = false,
}: ScopeSetupSummaryProps) {
  const trimmedName = scopeName.trim();
  const members = resolvedInvites(inviteRows);
  const viewItems = scopePreviewViewLabels(resolved);
  const templates =
    resolved.ok && resolved.templateSlugs.length > 0
      ? resolved.templateSlugs.map(getScopeTemplateLabel)
      : [];

  return (
    <div className="scope-setup-summary">
      <SummaryBlock label="Scope name" empty={trimmedName ? undefined : "Untitled scope"}>
        {trimmedName ? (
          <p className="scope-setup-summary__name-value">{trimmedName}</p>
        ) : null}
      </SummaryBlock>

      <div className="scope-setup-summary__columns">
        <SummaryBlock label="Views">
          <ul className="scope-setup-summary__list">
            {viewItems.map((view) => (
              <li key={view}>{view}</li>
            ))}
          </ul>
        </SummaryBlock>

        <SummaryBlock
          label="Templates"
          empty={templates.length === 0 ? "None selected" : undefined}
        >
          {templates.length > 0 ? (
            <ul className="scope-setup-summary__list">
              {templates.map((template) => (
                <li key={template}>{template}</li>
              ))}
            </ul>
          ) : null}
        </SummaryBlock>
      </div>

      {showMembers ? (
        <SummaryBlock
          label={members.length > 0 ? `Members (${members.length})` : "Members"}
          empty={members.length === 0 ? "No invites yet" : undefined}
        >
          {members.length > 0 ? (
            <ul className="scope-setup-summary__list scope-setup-summary__list--members">
              {members.map((member) => (
                <li key={member.key}>
                  <span className="scope-setup-summary__member-label">{member.label}</span>
                  <span className="scope-setup-summary__member-role">{member.role}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </SummaryBlock>
      ) : null}

      {!resolved.ok ? (
        <p className="scope-setup-summary__error">{resolved.reason}</p>
      ) : null}
    </div>
  );
}
