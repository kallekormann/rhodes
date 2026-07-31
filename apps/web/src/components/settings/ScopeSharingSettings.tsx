"use client";

import { Divider } from "@/components/Divider";
import { RadioGroup } from "@/components/Radio";
import { GroupLabel } from "@/components/SectionHeader";
import type {
  PrivateScopePolicy,
  TeamScopePolicy,
} from "@rhodes/shared/scope-policies";

type ScopeSharingSettingsProps = {
  scopeName: string;
  isTeam: boolean;
  policy: PrivateScopePolicy | TeamScopePolicy;
  canEdit: boolean;
  saving: boolean;
  onSave: (patch: Record<string, unknown>) => void;
};

const privateExternalOptions = [
  { value: "disabled", label: "Nobody outside this scope" },
  { value: "guests_only", label: "Guests only" },
  { value: "members_allowed", label: "Guests and members" },
] as const;

const privateOutboundOptions = [
  { value: "none", label: "Not allowed" },
  { value: "documents", label: "Documents" },
  { value: "documents_and_library", label: "Documents and library" },
] as const;

const privateInviteOptions = [
  { value: "false", label: "Admins only" },
  { value: "same_scope_only", label: "People in this scope" },
  { value: "org_members_only", label: "Organization members" },
  { value: "anyone_with_link", label: "Anyone with an invite link" },
] as const;

const teamOrgSharingOptions = [
  { value: "team_only", label: "This team only" },
  { value: "all_org_teams", label: "All teams in the organization" },
  { value: "selected_org_teams", label: "Selected teams" },
  { value: "org_wide", label: "Organization catalog" },
] as const;

const teamExternalOptions = [
  { value: "disabled", label: "Nobody outside the organization" },
  { value: "org_members_only", label: "Organization members" },
  { value: "guests_allowed", label: "Guests allowed" },
] as const;

const teamOutboundOptions = [
  { value: "none", label: "Not allowed" },
  { value: "team_only", label: "This team only" },
  { value: "selected_teams", label: "Selected teams" },
  { value: "org_wide", label: "Organization-wide" },
  { value: "private_scopes", label: "Member private scopes" },
] as const;

const teamInboundOptions = [
  { value: "none", label: "Nothing from outside" },
  { value: "org_teams_only", label: "Other organization teams" },
  { value: "linked_private", label: "Linked private scopes" },
  { value: "any_member_private", label: "Any member private scope" },
] as const;

const teamInviteOptions = [
  { value: "false", label: "Admins only" },
  { value: "team_members_only", label: "Team members" },
  { value: "org_members_only", label: "Organization members" },
  { value: "external_with_approval", label: "External guests with approval" },
] as const;

function PrivateSharingForm({
  policy,
  canEdit,
  onSave,
}: {
  policy: PrivateScopePolicy;
  canEdit: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <GroupLabel>Guests & collaborators</GroupLabel>
      <fieldset className="settings-field" disabled={!canEdit}>
        <legend className="settings-field__label">Who can be invited</legend>
        <p className="caption settings-field__hint">
          People outside this personal scope who can be added as guests or members.
        </p>
        <RadioGroup
          name="private-external-collaborators"
          value={policy.external_collaborators}
          onChange={(value) => onSave({ external_collaborators: value })}
          options={privateExternalOptions.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </fieldset>

      <fieldset className="settings-field" disabled={!canEdit}>
        <legend className="settings-field__label">Default role for new collaborators</legend>
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

      <Divider className="settings-section__divider" />

      <GroupLabel>Sharing to teams</GroupLabel>
      <fieldset className="settings-field" disabled={!canEdit}>
        <legend className="settings-field__label">Share content from this scope</legend>
        <p className="caption settings-field__hint">
          Whether documents or library files from this personal scope can be shared into team
          scopes.
        </p>
        <RadioGroup
          name="private-content-outbound"
          value={policy.content_sharing_outbound}
          onChange={(value) => onSave({ content_sharing_outbound: value })}
          options={privateOutboundOptions.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </fieldset>

      <Divider className="settings-section__divider" />

      <GroupLabel>Invitations</GroupLabel>
      <fieldset className="settings-field" disabled={!canEdit}>
        <legend className="settings-field__label">Who can invite others</legend>
        <RadioGroup
          name="private-can-invite"
          value={policy.collaborator_can_invite}
          onChange={(value) => onSave({ collaborator_can_invite: value })}
          options={privateInviteOptions.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </fieldset>
    </>
  );
}

function TeamSharingForm({
  policy,
  canEdit,
  onSave,
}: {
  policy: TeamScopePolicy;
  canEdit: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <GroupLabel>Organization visibility</GroupLabel>
      <fieldset className="settings-field" disabled={!canEdit}>
        <legend className="settings-field__label">Who can see this team</legend>
        <p className="caption settings-field__hint">
          How this team scope appears to other teams in your organization.
        </p>
        <RadioGroup
          name="team-org-sharing"
          value={policy.org_sharing}
          onChange={(value) => onSave({ org_sharing: value })}
          options={teamOrgSharingOptions.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </fieldset>

      <fieldset className="settings-field" disabled={!canEdit}>
        <legend className="settings-field__label">External collaborators</legend>
        <RadioGroup
          name="team-external-collaborators"
          value={policy.external_collaborators}
          onChange={(value) => onSave({ external_collaborators: value })}
          options={teamExternalOptions.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </fieldset>

      <Divider className="settings-section__divider" />

      <GroupLabel>Content sharing</GroupLabel>
      <fieldset className="settings-field" disabled={!canEdit}>
        <legend className="settings-field__label">Share content out of this team</legend>
        <RadioGroup
          name="team-content-outbound"
          value={policy.content_sharing_outbound}
          onChange={(value) => onSave({ content_sharing_outbound: value })}
          options={teamOutboundOptions.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </fieldset>

      <fieldset className="settings-field" disabled={!canEdit}>
        <legend className="settings-field__label">Accept content into this team</legend>
        <p className="caption settings-field__hint">
          Where shared documents and library files may come from.
        </p>
        <RadioGroup
          name="team-content-inbound"
          value={policy.content_sharing_inbound}
          onChange={(value) => onSave({ content_sharing_inbound: value })}
          options={teamInboundOptions.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </fieldset>

      <Divider className="settings-section__divider" />

      <GroupLabel>Members & invitations</GroupLabel>
      <fieldset className="settings-field" disabled={!canEdit}>
        <legend className="settings-field__label">Default role for new members</legend>
        <RadioGroup
          name="team-default-member"
          value={policy.default_member_role}
          onChange={(value) => onSave({ default_member_role: value })}
          options={[
            { value: "member", label: "Can edit" },
            { value: "viewer", label: "Can view" },
          ]}
        />
      </fieldset>

      <fieldset className="settings-field" disabled={!canEdit}>
        <legend className="settings-field__label">Who can invite others</legend>
        <RadioGroup
          name="team-can-invite"
          value={policy.collaborator_can_invite}
          onChange={(value) => onSave({ collaborator_can_invite: value })}
          options={teamInviteOptions.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </fieldset>
    </>
  );
}

export function ScopeSharingSettings({
  scopeName,
  isTeam,
  policy,
  canEdit,
  saving,
  onSave,
}: ScopeSharingSettingsProps) {
  return (
    <>
      {!canEdit ? (
        <p className="caption settings-field__hint">
          You can view sharing rules for {scopeName}. Only scope admins can change them.
        </p>
      ) : null}

      {isTeam ? (
        <TeamSharingForm
          policy={policy as TeamScopePolicy}
          canEdit={canEdit}
          onSave={onSave}
        />
      ) : (
        <PrivateSharingForm
          policy={policy as PrivateScopePolicy}
          canEdit={canEdit}
          onSave={onSave}
        />
      )}

      {canEdit && saving ? (
        <p className="caption settings-field__hint">Saving…</p>
      ) : null}
    </>
  );
}
