"use client";

import { getScopeTemplateLabel } from "@rhodes/shared/scope-template-catalog";
import type { ScopeCompositionOutcome } from "@rhodes/shared/scope-composition";
import type { InviteRow } from "@/components/scope-setup/ScopeTeamInviteStep";
import { resolvedInvites } from "@/lib/scope-setup/invites";
import { scopePreviewViewLabels } from "@/lib/scope-composition/preview";
import { WizardOutline, WizardOutlineDetail, TruncatedList } from "@/components/wizard";

type WizardScopeOutlineProps = {
  scopeName: string;
  resolved: ScopeCompositionOutcome;
  inviteRows: InviteRow[];
  showMembers?: boolean;
  previewLimit?: number;
};

export function WizardScopeOutline({
  scopeName,
  resolved,
  inviteRows,
  showMembers = false,
  previewLimit,
}: WizardScopeOutlineProps) {
  const members = resolvedInvites(inviteRows);
  const trimmedName = scopeName.trim();
  const viewItems = scopePreviewViewLabels(resolved);
  const templateItems =
    resolved.ok && resolved.templateSlugs.length > 0
      ? resolved.templateSlugs.map(getScopeTemplateLabel)
      : [];

  return (
    <WizardOutline>
      <WizardOutlineDetail
        label="Scope name"
        empty={trimmedName ? undefined : "Untitled scope"}
      >
        {trimmedName ? (
          <p className="wizard-outline__name-value">{trimmedName}</p>
        ) : null}
      </WizardOutlineDetail>

      <div className="wizard-outline__columns">
        <WizardOutlineDetail label="Views">
          {!resolved.ok ? (
            <p className="wizard-outline__empty">{resolved.reason}</p>
          ) : (
            <TruncatedList items={viewItems} limit={previewLimit} />
          )}
        </WizardOutlineDetail>

        <WizardOutlineDetail
          label="Templates"
          empty={templateItems.length === 0 ? "None selected" : undefined}
        >
          {templateItems.length > 0 ? (
            <TruncatedList items={templateItems} limit={previewLimit} />
          ) : null}
        </WizardOutlineDetail>
      </div>

      {showMembers ? (
        <WizardOutlineDetail
          label={members.length > 0 ? `Members (${members.length})` : "Members"}
          empty={members.length === 0 ? "No invites yet" : undefined}
        >
          {members.length > 0 ? (
            <ul className="wizard-outline__list wizard-outline__list--scroll">
              {members.map((member) => (
                <li key={member.key}>
                  <span className="wizard-outline__member-label">{member.label}</span>
                  <span className="wizard-outline__member-role">{member.role}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </WizardOutlineDetail>
      ) : null}
    </WizardOutline>
  );
}
