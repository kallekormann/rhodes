"use client";

import { useCallback, useEffect, useState } from "react";
import { RadioGroup } from "@/components/Radio";
import { Toggle } from "@/components/Toggle";
import { GroupLabel } from "@/components/SectionHeader";
import type { OrgPolicy } from "@rhodes/shared/scope-policies";
import "./ScopeSettingsPanels.css";

type OrgPolicySettingsProps = {
  orgId: string;
  orgName: string;
  canEdit: boolean;
};

export function OrgPolicySettings({ orgId, orgName, canEdit }: OrgPolicySettingsProps) {
  const [policy, setPolicy] = useState<OrgPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/app/api/organizations/${orgId}/policy`);
      const body = (await response.json().catch(() => ({}))) as {
        policy?: OrgPolicy;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Couldn't load org policy");
      setPolicy(body.policy ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load org policy");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Record<string, unknown>) => {
    if (!canEdit || !policy) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/app/api/organizations/${orgId}/policy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy: patch }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        policy?: OrgPolicy;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Couldn't save");
      setPolicy(body.policy ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="caption settings-section__empty">Loading organization settings…</p>;
  }

  if (error || !policy) {
    return <p className="caption settings-section__empty">{error ?? "Policy unavailable"}</p>;
  }

  return (
    <div className="scope-settings-panel">
      <GroupLabel>{orgName}</GroupLabel>
      <p className="caption scope-settings-panel__intro">
        Organization-wide ceilings for teams under this org. Team policies must be
        equal or stricter.
      </p>
      {!canEdit ? (
        <p className="caption scope-settings-field__hint">
          Only org owners and admins can edit these settings.
        </p>
      ) : null}

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <Toggle
          label="Guests allowed"
          checked={policy.guests_allowed}
          onChange={(e) => void save({ guests_allowed: e.target.checked })}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Who can invite guests</legend>
        <RadioGroup
          name="org-invite-guests"
          value={policy.who_can_invite_guests}
          onChange={(value) => void save({ who_can_invite_guests: value })}
          options={[
            { value: "owner", label: "Owners only" },
            { value: "admin", label: "Admins" },
            { value: "member", label: "Any org member" },
            { value: "request_approval", label: "Request approval" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Who can create teams</legend>
        <RadioGroup
          name="org-create-teams"
          value={policy.who_can_create_teams}
          onChange={(value) => void save({ who_can_create_teams: value })}
          options={[
            { value: "owner", label: "Owners only" },
            { value: "admin", label: "Admins" },
            { value: "org_member", label: "Any org member" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Default team visibility</legend>
        <RadioGroup
          name="org-team-visibility"
          value={policy.default_team_visibility}
          onChange={(value) => void save({ default_team_visibility: value })}
          options={[
            { value: "isolated", label: "Isolated" },
            { value: "org_catalog", label: "Org catalog" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">Cross-team content default</legend>
        <RadioGroup
          name="org-cross-team"
          value={policy.cross_team_content_default}
          onChange={(value) => void save({ cross_team_content_default: value })}
          options={[
            { value: "none", label: "None" },
            { value: "team_only", label: "Team only" },
            { value: "org_wide", label: "Org-wide" },
            { value: "selected_teams", label: "Selected teams" },
          ]}
        />
      </fieldset>

      <fieldset className="scope-settings-field" disabled={!canEdit}>
        <legend className="scope-settings-field__label">External sharing default</legend>
        <RadioGroup
          name="org-external-sharing"
          value={policy.external_sharing_default}
          onChange={(value) => void save({ external_sharing_default: value })}
          options={[
            { value: "blocked", label: "Blocked" },
            { value: "document_only", label: "Documents only" },
            { value: "guest_allowed", label: "Guests allowed" },
          ]}
        />
      </fieldset>

      {saving ? <p className="caption scope-settings-field__hint">Saving…</p> : null}
    </div>
  );
}
