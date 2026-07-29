"use client";

import { RadioGroup } from "@/components/Radio";
import { GroupLabel } from "@/components/SectionHeader";
import type {
  PrivateScopePolicy,
  TeamScopePolicy,
} from "@rhodes/shared/scope-policies";
import "./ScopeSettingsPanels.css";

type ScopeSharingSettingsProps = {
  isTeam: boolean;
  policy: PrivateScopePolicy | TeamScopePolicy;
  canEdit: boolean;
  saving: boolean;
  onSave: (patch: Record<string, unknown>) => void;
};

function PrivateSharingForm({
  policy,
  canEdit,
  saving,
  onSave,
}: {
  policy: PrivateScopePolicy;
  canEdit: boolean;
  saving: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">External collaborators</legend>
        <p className="caption scope-settings-field__hint">
          Who may be invited to this private scope as a guest.
        </p>
        <RadioGroup
          name="private-external-collaborators"
          value={policy.external_collaborators}
          onChange={(value) => onSave({ external_collaborators: value })}
          options={[
            { value: "disabled", label: "Disabled" },
            { value: "guests_only", label: "Guests only" },
            { value: "members_allowed", label: "Members allowed" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Default collaborator role</legend>
        <RadioGroup
          name="private-default-role"
          value={policy.default_collaborator_role}
          onChange={(value) => onSave({ default_collaborator_role: value })}
          options={[
            { value: "viewer", label: "Can view" },
            { value: "member", label: "Can edit" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Share documents to teams</legend>
        <p className="caption scope-settings-field__hint">
          Outbound sharing from this private scope (M2.5b enforces on share API).
        </p>
        <RadioGroup
          name="private-content-outbound"
          value={policy.content_sharing_outbound}
          onChange={(value) => onSave({ content_sharing_outbound: value })}
          options={[
            { value: "none", label: "None" },
            { value: "documents", label: "Documents only" },
            { value: "documents_and_library", label: "Documents and library" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Who can invite others</legend>
        <RadioGroup
          name="private-can-invite"
          value={policy.collaborator_can_invite}
          onChange={(value) => onSave({ collaborator_can_invite: value })}
          options={[
            { value: "false", label: "Nobody" },
            { value: "same_scope_only", label: "Same scope only" },
            { value: "org_members_only", label: "Org members only" },
            { value: "anyone_with_link", label: "Anyone with link" },
          ]}
        />
      </fieldset>

      {canEdit && saving ? (
        <p className="caption scope-settings-field__hint">Saving…</p>
      ) : null}
    </>
  );
}

function TeamSharingForm({
  policy,
  canEdit,
  saving,
  onSave,
}: {
  policy: TeamScopePolicy;
  canEdit: boolean;
  saving: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Org-wide sharing</legend>
        <p className="caption scope-settings-field__hint">
          How this team scope relates to other teams in the organization.
        </p>
        <RadioGroup
          name="team-org-sharing"
          value={policy.org_sharing}
          onChange={(value) => onSave({ org_sharing: value })}
          options={[
            { value: "team_only", label: "This team only" },
            { value: "all_org_teams", label: "All org teams" },
            { value: "selected_org_teams", label: "Selected org teams" },
            { value: "org_wide", label: "Org-wide catalog" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">External collaborators</legend>
        <RadioGroup
          name="team-external-collaborators"
          value={policy.external_collaborators}
          onChange={(value) => onSave({ external_collaborators: value })}
          options={[
            { value: "disabled", label: "Disabled" },
            { value: "org_members_only", label: "Org members only" },
            { value: "guests_allowed", label: "Guests allowed" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Share documents outward</legend>
        <RadioGroup
          name="team-content-outbound"
          value={policy.content_sharing_outbound}
          onChange={(value) => onSave({ content_sharing_outbound: value })}
          options={[
            { value: "none", label: "None" },
            { value: "team_only", label: "This team only" },
            { value: "selected_teams", label: "Selected teams" },
            { value: "org_wide", label: "Org-wide" },
            { value: "private_scopes", label: "Member private scopes" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Accept shares from</legend>
        <RadioGroup
          name="team-content-inbound"
          value={policy.content_sharing_inbound}
          onChange={(value) => onSave({ content_sharing_inbound: value })}
          options={[
            { value: "none", label: "None" },
            { value: "org_teams_only", label: "Org teams only" },
            { value: "linked_private", label: "Linked private scopes" },
            { value: "any_member_private", label: "Any member private scope" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Default member role</legend>
        <RadioGroup
          name="team-default-member"
          value={policy.default_member_role}
          onChange={(value) => onSave({ default_member_role: value })}
          options={[
            { value: "member", label: "Member" },
            { value: "viewer", label: "Viewer" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Who can invite others</legend>
        <RadioGroup
          name="team-can-invite"
          value={policy.collaborator_can_invite}
          onChange={(value) => onSave({ collaborator_can_invite: value })}
          options={[
            { value: "false", label: "Nobody" },
            { value: "team_members_only", label: "Team members only" },
            { value: "org_members_only", label: "Org members only" },
            { value: "external_with_approval", label: "External with approval" },
          ]}
        />
      </fieldset>

      {canEdit && saving ? (
        <p className="caption scope-settings-field__hint">Saving…</p>
      ) : null}
    </>
  );
}

export function ScopeSharingSettings({
  isTeam,
  policy,
  canEdit,
  saving,
  onSave,
}: ScopeSharingSettingsProps) {
  return (
    <div className="scope-settings-panel">
      <GroupLabel>Sharing policy</GroupLabel>
      <p className="caption scope-settings-panel__intro">
        Controls who can collaborate and how documents leave this scope. Full
        enforcement on share APIs lands in M2.5b; library/RAG bounds in M7.
      </p>
      {!canEdit ? (
        <p className="caption scope-settings-panel__intro">
          Only scope admins can change sharing policy.
        </p>
      ) : null}
      {isTeam ? (
        <TeamSharingForm
          policy={policy as TeamScopePolicy}
          canEdit={canEdit}
          saving={saving}
          onSave={onSave}
        />
      ) : (
        <PrivateSharingForm
          policy={policy as PrivateScopePolicy}
          canEdit={canEdit}
          saving={saving}
          onSave={onSave}
        />
      )}
    </div>
  );
}
