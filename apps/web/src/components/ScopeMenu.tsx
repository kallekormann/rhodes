import type { ReactNode } from "react";
import { Building2, Check, Lock, Plus, Settings, User, Users } from "lucide-react";
import type { Organization } from "@/data/organizations";
import { canManageOrgTeams } from "@/data/organizations";
import type { Scope } from "@/data/scopes";
import { UserAvatar } from "@/components/UserAvatar";
import type { OrgPickerGroup } from "@/lib/workspaces/scope-picker";
import "./ScopeSwitcher.css";

import {
  TEAM_ROLE_LABELS,
} from "@rhodes/shared/team-roles";

const roleLabels = TEAM_ROLE_LABELS;

export type ScopeMenuProps = {
  personalPrivateScopes: Scope[];
  personalTeamScopes: Scope[];
  orgGroups: OrgPickerGroup[];
  activeScopeId: string;
  userLabel?: string;
  userAvatarUrl?: string | null;
  userId?: string;
  canCreatePersonalSpace?: boolean;
  canCreateTeamSpace?: boolean;
  canCreateOrgTeam?: (org: Organization) => boolean;
  onSelect?: (scope: Scope) => void;
  onCreatePersonal?: () => void;
  onCreateTeam?: () => void;
  onCreateOrgTeam?: (org: Organization) => void;
  onManage?: () => void;
  className?: string;
  inline?: boolean;
};

function ScopeListItem({
  scope,
  activeScopeId,
  icon,
  meta,
  onSelect,
}: {
  scope: Scope;
  activeScopeId: string;
  icon: ReactNode;
  meta: string;
  onSelect?: (scope: Scope) => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={activeScopeId === scope.id}
        className={`scope-menu__item ${activeScopeId === scope.id ? "scope-menu__item--active" : ""}`}
        onClick={() => onSelect?.(scope)}
      >
        <span className="scope-menu__item-icon" aria-hidden>
          {icon}
        </span>
        <span className="scope-menu__item-main">
          <span className="scope-menu__item-name">{scope.name}</span>
          <span className="scope-menu__item-meta">{meta}</span>
        </span>
        {activeScopeId === scope.id && (
          <Check size={16} strokeWidth={1.75} className="scope-menu__check" />
        )}
      </button>
    </li>
  );
}

function OrgGroupSection({
  group,
  activeScopeId,
  canCreateOrgTeam,
  onSelect,
  onCreateOrgTeam,
}: {
  group: OrgPickerGroup;
  activeScopeId: string;
  canCreateOrgTeam?: (org: Organization) => boolean;
  onSelect?: (scope: Scope) => void;
  onCreateOrgTeam?: (org: Organization) => void;
}) {
  const { org, teams, collapsed } = group;
  const allowCreate = canCreateOrgTeam?.(org) ?? canManageOrgTeams(org);

  if (collapsed && teams[0]) {
    const team = teams[0];
    return (
      <section className="scope-menu__section">
        <header className="scope-menu__heading">
          <Building2 size={14} strokeWidth={1.75} />
          {org.name}
        </header>
        <p className="scope-menu__hint">Organization team scope.</p>
        <ul className="scope-menu__list">
          <ScopeListItem
            scope={team}
            activeScopeId={activeScopeId}
            icon={<Users size={16} strokeWidth={1.75} className="scope-menu__item-icon--team" />}
            meta={`${org.name} · ${roleLabels[team.role]}`}
            onSelect={onSelect}
          />
        </ul>
      </section>
    );
  }

  return (
    <section className="scope-menu__section scope-menu__section--org">
      <header className="scope-menu__heading">
        <Building2 size={14} strokeWidth={1.75} />
        {org.name}
      </header>
      <p className="scope-menu__hint">Teams under your organization.</p>
      <ul className="scope-menu__list">
        {teams.length === 0 ? (
          <li className="scope-menu__empty caption">No org teams yet.</li>
        ) : (
          teams.map((scope) => (
            <ScopeListItem
              key={scope.id}
              scope={scope}
              activeScopeId={activeScopeId}
              icon={<Users size={16} strokeWidth={1.75} className="scope-menu__item-icon--team" />}
              meta={`Team · ${roleLabels[scope.role]}`}
              onSelect={onSelect}
            />
          ))
        )}
      </ul>
      {allowCreate ? (
        <button
          type="button"
          className="scope-menu__create"
          onClick={() => onCreateOrgTeam?.(org)}
        >
          <Plus size={16} strokeWidth={1.75} />
          New org team
        </button>
      ) : null}
    </section>
  );
}

export function ScopeMenu({
  personalPrivateScopes,
  personalTeamScopes,
  orgGroups,
  activeScopeId,
  userLabel,
  userAvatarUrl = null,
  userId,
  canCreatePersonalSpace = true,
  canCreateTeamSpace = true,
  canCreateOrgTeam,
  onSelect,
  onCreatePersonal,
  onCreateTeam,
  onCreateOrgTeam,
  onManage,
  className = "",
  inline = false,
}: ScopeMenuProps) {
  const hasPersonalTeams = personalTeamScopes.length > 0 || canCreateTeamSpace;

  return (
    <div
      className={`scope-menu ${inline ? "scope-menu--inline" : ""} ${className}`.trim()}
      role="listbox"
      aria-label="Switch scope"
    >
      <div className="scope-menu__scroll overlay-scrollbar">
        <section className="scope-menu__section">
          <header className="scope-menu__heading">
            <User size={14} strokeWidth={1.75} />
            Personal
          </header>
          {userLabel ? (
            <p className="scope-menu__user caption">
              {userId ? (
                <UserAvatar
                  name={userLabel}
                  userId={userId}
                  src={userAvatarUrl}
                  size="sm"
                  className="scope-menu__user-avatar"
                />
              ) : null}
              <span>{userLabel}</span>
            </p>
          ) : null}
          <p className="scope-menu__hint">
            Private scopes and standalone teams — separate from any organization.
          </p>
          <ul className="scope-menu__list">
            {personalPrivateScopes.map((scope) => (
              <ScopeListItem
                key={scope.id}
                scope={scope}
                activeScopeId={activeScopeId}
                icon={<Lock size={16} strokeWidth={1.75} />}
                meta="Personal · only you"
                onSelect={onSelect}
              />
            ))}
          </ul>
          {canCreatePersonalSpace ? (
            <button type="button" className="scope-menu__create" onClick={onCreatePersonal}>
              <Plus size={16} strokeWidth={1.75} />
              New personal scope
            </button>
          ) : (
            <p className="scope-menu__upgrade caption">
              Personal scope limit reached. Upgrade for more.
            </p>
          )}
        </section>

        {hasPersonalTeams ? (
          <>
            <hr className="scope-menu__divider" />
            <section className="scope-menu__section">
              <header className="scope-menu__heading">
                <Users size={14} strokeWidth={1.75} />
                Standalone teams
              </header>
              <p className="scope-menu__hint">Team scopes outside an organization.</p>
              <ul className="scope-menu__list">
                {personalTeamScopes.length === 0 ? (
                  <li className="scope-menu__empty caption">No standalone teams yet.</li>
                ) : (
                  personalTeamScopes.map((scope) => (
                    <ScopeListItem
                      key={scope.id}
                      scope={scope}
                      activeScopeId={activeScopeId}
                      icon={<Users size={16} strokeWidth={1.75} className="scope-menu__item-icon--team" />}
                      meta={`Team · ${roleLabels[scope.role]}`}
                      onSelect={onSelect}
                    />
                  ))
                )}
              </ul>
              {canCreateTeamSpace ? (
                <button type="button" className="scope-menu__create" onClick={onCreateTeam}>
                  <Plus size={16} strokeWidth={1.75} />
                  New standalone team
                </button>
              ) : (
                <p className="scope-menu__upgrade caption">
                  Team scope limit reached. Upgrade for more.
                </p>
              )}
            </section>
          </>
        ) : null}

        {orgGroups.length > 0 ? (
          <>
            <hr className="scope-menu__divider" />
            {orgGroups.map((group) => (
              <OrgGroupSection
                key={group.org.id}
                group={group}
                activeScopeId={activeScopeId}
                canCreateOrgTeam={canCreateOrgTeam}
                onSelect={onSelect}
                onCreateOrgTeam={onCreateOrgTeam}
              />
            ))}
          </>
        ) : null}
      </div>

      <footer className="scope-menu__footer">
        <button type="button" className="scope-menu__settings" onClick={onManage}>
          <Settings size={14} strokeWidth={1.75} />
          Manage scopes…
        </button>
      </footer>
    </div>
  );
}
