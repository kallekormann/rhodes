"use client";

import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { Divider } from "@/components/Divider";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { ItemList, ListRow } from "@/components/ListRow";
import { Modal } from "@/components/Modal";
import { NavLink } from "@/components/NavLink";
import { RadioGroup } from "@/components/Radio";
import { ScopeCreateModal } from "@/components/ScopeCreateModal";
import { TeamMembersTable } from "@/components/settings/TeamMembersTable";
import { GroupLabel, SectionHeader } from "@/components/SectionHeader";
import { Toggle } from "@/components/Toggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { createClient } from "@/lib/supabase/client";
import type { Scope } from "@/data/scopes";
import { buildFeatureGates } from "@/lib/features/gates";
import { canDeleteScope, canRenameScope } from "@/lib/workspaces/permissions";
import { TEAM_ROLE_LABELS } from "@rhodes/shared/team-roles";
import type { AssignableTeamRole } from "@rhodes/shared/team-roles";
import {
  readDefaultScopeId,
  writeDefaultScopeId,
} from "@/lib/workspaces/scope";
import type { ThemeMode } from "@/context/AppContext";
import "./SettingsView.css";

const navItems = [
  "Profile",
  "Security",
  "Preferences",
  "Scopes",
  "Team",
  "Billing",
  "Privacy",
] as const;

type SettingsSection = (typeof navItems)[number];
type CreateKind = "personal" | "team" | null;

const roleLabels = TEAM_ROLE_LABELS;

const languageOptions = [
  { id: "en", label: "English" },
  { id: "de", label: "Deutsch" },
  { id: "es", label: "Español" },
];

const inviteRoleOptions = [
  { id: "member", label: "Member" },
  { id: "viewer", label: "Viewer" },
  { id: "admin", label: "Admin" },
];

function ScopeList({
  scopes,
  personalScopes,
  activeScopeId,
  metaForScope,
  onSwitch,
  onRename,
  onDelete,
  emptyLabel,
}: {
  scopes: Scope[];
  personalScopes: Scope[];
  activeScopeId: string;
  metaForScope: (scope: Scope) => string;
  onSwitch: (scopeId: string) => void;
  onRename: (scope: Scope) => void;
  onDelete: (scope: Scope) => void;
  emptyLabel?: string;
}) {
  if (scopes.length === 0) {
    return <p className="caption settings-section__empty">{emptyLabel}</p>;
  }

  const uniqueScopes = scopes.filter(
    (scope, index, arr) => arr.findIndex((s) => s.id === scope.id) === index,
  );

  return (
    <ItemList>
      {uniqueScopes.map((scope) => {
        const showRename = canRenameScope(scope);
        const showDelete = canDeleteScope(scope, personalScopes);

        return (
          <ListRow
            key={scope.id}
            title={scope.name}
            meta={metaForScope(scope)}
            badge={activeScopeId === scope.id ? "Active" : undefined}
            active={activeScopeId === scope.id}
            actions={
              showRename || showDelete ? (
                <>
                  {showRename && (
                    <button
                      type="button"
                      className="list-row__action"
                      aria-label={`Rename ${scope.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRename(scope);
                      }}
                    >
                      <Pencil size={15} strokeWidth={1.75} />
                    </button>
                  )}
                  {showDelete && (
                    <button
                      type="button"
                      className="list-row__action list-row__action--danger"
                      aria-label={`Delete ${scope.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(scope);
                      }}
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                  )}
                </>
              ) : undefined
            }
            onClick={() => {
              if (activeScopeId !== scope.id) onSwitch(scope.id);
            }}
          />
        );
      })}
    </ItemList>
  );
}

export function SettingsView() {
  const {
    session,
    setView,
    themeMode,
    setThemeMode,
    scopes,
    activeScope,
    setActiveScope,
    createPersonalSpace,
    createTeamSpace,
    canCreatePersonalSpace,
    canCreateTeamSpace,
    updateDisplayName,
    showToast,
    refreshScopes,
  } = useApp();
  const [section, setSection] = useState<SettingsSection>("Profile");
  const searchParams = useSearchParams();

  useEffect(() => {
    const requested = searchParams.get("section");
    if (
      requested &&
      navItems.includes(requested as SettingsSection)
    ) {
      setSection(requested as SettingsSection);
    }
  }, [searchParams]);
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [displayName, setDisplayName] = useState(session.displayName);
  const [language, setLanguage] = useState("en");
  const [savingProfile, setSavingProfile] = useState(false);
  const [defaultScopeId, setDefaultScopeId] = useState("");
  const [knowledgeBridgeEmail, setKnowledgeBridgeEmail] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Scope | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Scope | null>(null);
  const [deleting, setDeleting] = useState(false);

  const personalScopes = scopes.filter(
    (scope, index, arr) =>
      scope.type === "private" && arr.findIndex((s) => s.id === scope.id) === index,
  );
  const teamScopes = scopes.filter(
    (scope, index, arr) =>
      scope.type === "team" && arr.findIndex((s) => s.id === scope.id) === index,
  );
  const teamScopeId = activeScope.type === "team" ? activeScope.id : null;
  const {
    members,
    pendingInvites,
    loading: membersLoading,
    error: membersError,
    refresh: refreshMembers,
    addPendingInvite,
    removeMemberLocal,
    removePendingInviteLocal,
    updateMemberRoleLocal,
  } = useWorkspaceMembers(teamScopeId);

  const effectiveTeamRole = useMemo(() => {
    if (activeScope.type !== "team") return undefined;
    const membershipRole = members.find(
      (member) => member.user_id === session.userId,
    )?.role;
    return membershipRole ?? activeScope.role;
  }, [activeScope.role, activeScope.type, members, session.userId]);

  const teamFeatureGates = useMemo(
    () =>
      activeScope.type === "team"
        ? buildFeatureGates({ teamRole: effectiveTeamRole })
        : null,
    [activeScope.type, effectiveTeamRole],
  );
  const canInviteTeam = teamFeatureGates?.canManageTeam("team.invite") ?? false;
  const canChangeTeamRoles =
    teamFeatureGates?.canManageTeam("team.change_role") ?? false;
  const canRemoveTeamMembers =
    teamFeatureGates?.canManageTeam("team.remove_member") ?? false;
  const inviteRoleChoices = useMemo(() => {
    if (!teamFeatureGates || !canInviteTeam) return [];
    const actorRole = effectiveTeamRole;
    if (actorRole === "owner") return inviteRoleOptions;
    if (actorRole === "admin") {
      return inviteRoleOptions.filter((option) => option.id !== "admin");
    }
    return [];
  }, [canInviteTeam, effectiveTeamRole, teamFeatureGates]);

  useEffect(() => {
    if (section === "Team" && teamScopeId) {
      void refreshMembers();
    }
  }, [section, teamScopeId, refreshMembers]);

  useEffect(() => {
    setDisplayName(session.displayName);
  }, [session.displayName]);

  useEffect(() => {
    const stored = readDefaultScopeId();
    if (stored && scopes.some((s) => s.id === stored)) {
      setDefaultScopeId(stored);
      return;
    }
    setDefaultScopeId(activeScope.id);
  }, [activeScope.id, scopes]);

  const handleCreate = (name: string) => {
    if (createKind === "personal") void createPersonalSpace(name);
    if (createKind === "team") void createTeamSpace(name);
    setCreateKind(null);
  };

  const handleThemeModeChange = (value: string) => {
    setThemeMode(value as ThemeMode);
  };

  const handleSaveProfile = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      showToast("Display name can't be empty", "error");
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch("/app/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        profile?: { display_name: string };
      };

      if (!response.ok) {
        showToast(body.error ?? "Couldn't save profile", "error");
        return;
      }

      const savedName = body.profile?.display_name ?? trimmed;
      setDisplayName(savedName);
      updateDisplayName(savedName);
      showToast("Profile saved", "success");
    } catch {
      showToast("Couldn't save profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDefaultScopeChange = (scopeId: string) => {
    setDefaultScopeId(scopeId);
    writeDefaultScopeId(scopeId);
    showToast("Default scope updated", "success");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords don't match", "error");
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showToast(error.message, "error");
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password updated", "success");
    } catch {
      showToast("Couldn't update password", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  const openRenameScope = (scope: Scope) => {
    setRenameTarget(scope);
    setRenameValue(scope.name);
  };

  const handleRenameScope = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      showToast("Scope name can't be empty", "error");
      return;
    }

    setRenaming(true);
    try {
      const response = await fetch(`/app/api/workspaces/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        showToast(body.error ?? "Couldn't rename scope", "error");
        return;
      }

      await refreshScopes();
      setRenameTarget(null);
      showToast("Scope renamed", "success");
    } catch {
      showToast("Couldn't rename scope", "error");
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteScope = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const response = await fetch(`/app/api/workspaces/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        showToast(body.error ?? "Couldn't delete scope", "error");
        return;
      }

      await refreshScopes();
      setDeleteTarget(null);
      showToast(`"${deleteTarget.name}" deleted`, "success");
    } catch {
      showToast("Couldn't delete scope", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!teamScopeId || !canRemoveTeamMembers) return;

    setRemovingMemberId(userId);
    try {
      const response = await fetch(
        `/app/api/workspaces/${teamScopeId}/members/${userId}`,
        { method: "DELETE" },
      );
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        showToast(body.error ?? "Couldn't remove member", "error");
        return;
      }

      removeMemberLocal(userId);
      showToast("Member removed", "success");
    } catch {
      showToast("Couldn't remove member", "error");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!teamScopeId || !canInviteTeam) return;

    setCancelingInviteId(inviteId);
    try {
      const response = await fetch(
        `/app/api/workspaces/${teamScopeId}/invites/${inviteId}`,
        { method: "DELETE" },
      );
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        showToast(body.error ?? "Couldn't cancel invite", "error");
        return;
      }

      removePendingInviteLocal(inviteId);
      showToast("Invite canceled", "success");
    } catch {
      showToast("Couldn't cancel invite", "error");
    } finally {
      setCancelingInviteId(null);
    }
  };

  const handleChangeMemberRole = async (userId: string, role: AssignableTeamRole) => {
    if (!teamScopeId || !canChangeTeamRoles) return;

    setUpdatingMemberId(userId);
    try {
      const response = await fetch(
        `/app/api/workspaces/${teamScopeId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        showToast(body.error ?? "Couldn't update role", "error");
        return;
      }

      updateMemberRoleLocal(userId, role);
      showToast("Role updated", "success");
    } catch {
      showToast("Couldn't update role", "error");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleSendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !teamScopeId || !canInviteTeam) return;

    setSendingInvite(true);
    try {
      const response = await fetch(`/app/api/workspaces/${teamScopeId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        invite_url?: string;
        email_sent?: boolean;
        email_error?: string | null;
        pending_invite?: {
          id: string;
          email: string;
          role: "admin" | "member" | "viewer";
          expires_at: string;
          created_at: string;
        };
      };

      if (!response.ok) {
        showToast(body.error ?? "Couldn't send invite", "error");
        return;
      }

      setInviteEmail("");
      if (body.pending_invite) {
        addPendingInvite(body.pending_invite);
      }
      void refreshMembers();

      if (body.email_sent) {
        showToast(`Invite sent to ${email} — check Mailpit at http://localhost:8025`, "success");
      } else {
        const detail = body.email_error
          ? ` ${body.email_error}`
          : " Check Mailpit is running and restart the dev server after SMTP env changes.";
        showToast(`Invite saved for ${email}, but email wasn't sent.${detail}`, "info");
        if (body.invite_url) {
          console.info("Invite link:", body.invite_url);
        }
      }
    } catch {
      showToast("Couldn't send invite", "error");
    } finally {
      setSendingInvite(false);
    }
  };

  const scopeOptions = scopes.map((scope) => ({
    id: scope.id,
    label:
      scope.type === "private" ? `Personal · ${scope.name}` : `Team · ${scope.name}`,
  }));

  return (
    <div className="settings-view">
      <div className="settings-view__topbar">
        <NavLink icon={ArrowLeft} onClick={() => setView("editor")}>
          Settings
        </NavLink>
      </div>

      <div className="settings-view__layout">
        <nav className="settings-nav">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`settings-nav__item ${section === item ? "settings-nav__item--active" : ""}`}
              onClick={() => setSection(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="settings-view__scroll overlay-scrollbar">
          <div
            className={`settings-content ${section === "Team" ? "settings-content--wide" : ""}`}
          >
          {section === "Profile" && (
            <div className="settings-section">
              <div className="settings-field">
                <label className="settings-field__label" htmlFor="display-name">
                  Display name
                </label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={setDisplayName}
                />
              </div>
              <div className="settings-field">
                <label className="settings-field__label" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={session.userEmail}
                  disabled
                />
              </div>
              <div className="settings-field">
                <label className="settings-field__label" htmlFor="language">
                  Language
                </label>
                <Dropdown
                  variant="field"
                  value={language}
                  options={languageOptions}
                  onChange={setLanguage}
                />
                <p className="caption settings-field__hint">
                  Full localization ships in a later release.
                </p>
              </div>
              <fieldset className="settings-field">
                <legend className="settings-field__label">Theme</legend>
                <RadioGroup
                  name="settings-theme"
                  value={themeMode}
                  onChange={handleThemeModeChange}
                  options={[
                    { value: "system", label: "System" },
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ]}
                />
              </fieldset>
              <Button loading={savingProfile} onClick={() => void handleSaveProfile()}>
                Save profile
              </Button>
            </div>
          )}

          {section === "Security" && (
            <div className="settings-section">
              <GroupLabel>Password</GroupLabel>
              <div className="settings-field">
                <label className="settings-field__label" htmlFor="new-password">
                  New password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="settings-field">
                <label className="settings-field__label" htmlFor="confirm-password">
                  Confirm password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                />
              </div>
              <Button
                loading={changingPassword}
                disabled={!newPassword || !confirmPassword}
                onClick={() => void handleChangePassword()}
              >
                Change password
              </Button>

              <Divider className="settings-section__divider" />

              <GroupLabel>Session</GroupLabel>
              <p className="caption settings-field__hint">
                Ends your session on all devices.
              </p>
              <LogoutButton />

              <Divider className="settings-section__divider" />

              <GroupLabel>Two-factor authentication</GroupLabel>
              <p className="caption settings-field__hint">Coming in V1.5.</p>
            </div>
          )}

          {section === "Preferences" && (
            <div className="settings-section">
              <div className="settings-field">
                <label className="settings-field__label" htmlFor="default-scope">
                  Default scope
                </label>
                <Dropdown
                  variant="field"
                  value={defaultScopeId}
                  options={scopeOptions}
                  onChange={handleDefaultScopeChange}
                />
                <p className="caption settings-field__hint">
                  Used when you sign in on a new device.
                </p>
              </div>
              <fieldset className="settings-field">
                <legend className="settings-field__label">Email notifications</legend>
                <Toggle
                  label="Knowledge bridge digests"
                  checked={knowledgeBridgeEmail}
                  onChange={(e) => setKnowledgeBridgeEmail(e.target.checked)}
                />
                <p className="caption settings-field__hint">
                  Email delivery is configured in Phase 12.
                </p>
              </fieldset>
            </div>
          )}

          {section === "Scopes" && (
            <div className="settings-section">
              <p className="caption settings-section__intro">
                Personal scopes are private to you. Team scopes are shared with members.
              </p>

              <SectionHeader
                title="Personal"
                action={
                  canCreatePersonalSpace
                    ? {
                        label: "New personal scope",
                        onClick: () => setCreateKind("personal"),
                      }
                    : undefined
                }
              />
              <ScopeList
                scopes={personalScopes}
                personalScopes={personalScopes}
                activeScopeId={activeScope.id}
                metaForScope={() => "Personal · Owner"}
                onSwitch={setActiveScope}
                onRename={openRenameScope}
                onDelete={setDeleteTarget}
              />

              <SectionHeader
                title="Team"
                action={
                  canCreateTeamSpace
                    ? {
                        label: "New team scope",
                        onClick: () => setCreateKind("team"),
                      }
                    : undefined
                }
              />
              <ScopeList
                scopes={teamScopes}
                personalScopes={personalScopes}
                activeScopeId={activeScope.id}
                metaForScope={(scope) => `Team · ${roleLabels[scope.role]}`}
                onSwitch={setActiveScope}
                onRename={openRenameScope}
                onDelete={setDeleteTarget}
                emptyLabel="No team scopes yet."
              />
            </div>
          )}

          {section === "Team" && (
            <div className="settings-section">
              {activeScope.type !== "team" ? (
                <p className="caption">
                  Team settings apply to team scopes. Switch to a team scope under Scopes, or
                  create one.
                </p>
              ) : (
                <>
                  <SectionHeader title={`Members of ${activeScope.name}`} />

                  {membersLoading ? (
                    <p className="caption settings-section__empty">Loading members…</p>
                  ) : membersError ? (
                    <p className="caption settings-section__empty">{membersError}</p>
                  ) : members.length === 0 && pendingInvites.length === 0 ? (
                    <p className="caption settings-section__empty">No members yet.</p>
                  ) : (
                    <TeamMembersTable
                      members={members}
                      pendingInvites={pendingInvites}
                      currentUserId={session.userId}
                      canInvite={canInviteTeam}
                      canChangeRoles={canChangeTeamRoles}
                      canRemoveMembers={canRemoveTeamMembers}
                      removingMemberId={removingMemberId}
                      cancelingInviteId={cancelingInviteId}
                      updatingMemberId={updatingMemberId}
                      onRemoveMember={(userId) => void handleRemoveMember(userId)}
                      onCancelInvite={(inviteId) => void handleCancelInvite(inviteId)}
                      onChangeRole={(userId, role) =>
                        void handleChangeMemberRole(userId, role)
                      }
                    />
                  )}

                  {canInviteTeam && (
                    <>
                      <Divider className="settings-section__divider" />
                      <GroupLabel>Invite</GroupLabel>
                      <div className="settings-field">
                        <label className="settings-field__label" htmlFor="invite-email">
                          Email
                        </label>
                        <Input
                          id="invite-email"
                          type="email"
                          value={inviteEmail}
                          onChange={setInviteEmail}
                          placeholder="colleague@company.com"
                        />
                      </div>
                      <div className="settings-field">
                        <label className="settings-field__label" htmlFor="invite-role">
                          Role
                        </label>
                        <Dropdown
                          variant="field"
                          value={inviteRole}
                          options={inviteRoleChoices}
                          onChange={setInviteRole}
                        />
                      </div>
                      <Button
                        loading={sendingInvite}
                        disabled={!inviteEmail.trim()}
                        onClick={() => void handleSendInvite()}
                      >
                        Send invite
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {section === "Billing" && (
            <div className="settings-section">
              <GroupLabel>Plan</GroupLabel>
              <p className="caption settings-field__hint">
                You&apos;re on the early access plan. Billing and upgrades are configured in
                Phase 11.
              </p>
              <Button variant="secondary" disabled>
                Upgrade to Pro
              </Button>
            </div>
          )}

          {section === "Privacy" && (
            <div className="settings-section">
              <GroupLabel>Data &amp; privacy</GroupLabel>
              <p className="caption settings-field__hint">
                Export and account deletion are built in Phase 12. Your data stays in your
                scopes unless you share it.
              </p>
            </div>
          )}
          </div>
        </div>
      </div>

      <Modal
        open={renameTarget !== null}
        title="Rename scope"
        onClose={() => setRenameTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              loading={renaming}
              disabled={!renameValue.trim()}
              onClick={() => void handleRenameScope()}
            >
              Save
            </Button>
          </>
        }
      >
        <Input
          value={renameValue}
          onChange={setRenameValue}
          placeholder="Scope name"
        />
      </Modal>

      <Dialog
        open={deleteTarget !== null}
        title="Delete scope?"
        description={
          deleteTarget
            ? `All documents and library items in "${deleteTarget.name}" will be permanently removed.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteScope()}
        onClose={() => setDeleteTarget(null)}
      />

      <ScopeCreateModal
        open={createKind === "personal"}
        title="New personal scope"
        placeholder="e.g. Book draft, Research notes"
        onClose={() => setCreateKind(null)}
        onSubmit={handleCreate}
      />
      <ScopeCreateModal
        open={createKind === "team"}
        title="New team scope"
        placeholder="e.g. Growth Engine"
        onClose={() => setCreateKind(null)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
