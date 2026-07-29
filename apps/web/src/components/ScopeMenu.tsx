import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  Lock,
  Plus,
  Settings,
  User,
  Users,
} from "lucide-react";
import type { Organization } from "@/data/organizations";
import { canManageOrgTeams } from "@/data/organizations";
import type { Scope } from "@/data/scopes";
import { UserAvatar } from "@/components/UserAvatar";
import type { OrgPickerGroup } from "@/lib/workspaces/scope-picker";
import "./ScopeSwitcher.css";

import { TEAM_ROLE_LABELS } from "@rhodes/shared/team-roles";

const roleLabels = TEAM_ROLE_LABELS;

const PERSONAL_SECTION_ID = "personal";

export type ScopeMenuProps = {
  personalPrivateScopes: Scope[];
  personalTeamScopes: Scope[];
  orgGroups: OrgPickerGroup[];
  activeScopeId: string;
  userLabel?: string;
  userAvatarUrl?: string | null;
  userId?: string;
  menuOpen?: boolean;
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

function orgSectionId(orgId: string) {
  return `org:${orgId}`;
}

function buildDefaultExpanded(
  activeScopeId: string,
  personalPrivateScopes: Scope[],
  personalTeamScopes: Scope[],
  orgGroups: OrgPickerGroup[],
): Record<string, boolean> {
  const inPersonal =
    personalPrivateScopes.some((s) => s.id === activeScopeId) ||
    personalTeamScopes.some((s) => s.id === activeScopeId);

  const expanded: Record<string, boolean> = {
    [PERSONAL_SECTION_ID]: inPersonal || orgGroups.length === 0,
  };

  for (const group of orgGroups) {
    const activeInOrg = group.teams.some((t) => t.id === activeScopeId);
    expanded[orgSectionId(group.org.id)] = activeInOrg;
  }

  if (
    !inPersonal &&
    !orgGroups.some((g) => g.teams.some((t) => t.id === activeScopeId))
  ) {
    expanded[PERSONAL_SECTION_ID] = true;
  }

  return expanded;
}

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

function CollapsibleSection({
  sectionId,
  title,
  icon,
  hint,
  expanded,
  onToggle,
  children,
}: {
  sectionId: string;
  title: string;
  icon: ReactNode;
  hint?: string;
  expanded: boolean;
  onToggle: (sectionId: string) => void;
  children: ReactNode;
}) {
  const panelId = `scope-section-${sectionId}`;

  return (
    <section className="scope-menu__section scope-menu__section--collapsible">
      <button
        type="button"
        className="scope-menu__section-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => onToggle(sectionId)}
      >
        <span className="scope-menu__section-toggle-main">
          <span className="scope-menu__section-toggle-icon" aria-hidden>
            {icon}
          </span>
          <span className="scope-menu__section-toggle-label">{title}</span>
        </span>
        <ChevronRight
          size={16}
          strokeWidth={1.75}
          className={`scope-menu__section-chevron ${expanded ? "scope-menu__section-chevron--open" : ""}`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div id={panelId} className="scope-menu__section-body">
          {hint ? <p className="scope-menu__hint">{hint}</p> : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

function PersonalTeamsSection({
  personalPrivateScopes,
  personalTeamScopes,
  activeScopeId,
  expanded,
  onToggle,
  canCreatePersonalSpace,
  canCreateTeamSpace,
  onSelect,
  onCreatePersonal,
  onCreateTeam,
}: {
  personalPrivateScopes: Scope[];
  personalTeamScopes: Scope[];
  activeScopeId: string;
  expanded: boolean;
  onToggle: (sectionId: string) => void;
  canCreatePersonalSpace: boolean;
  canCreateTeamSpace: boolean;
  onSelect?: (scope: Scope) => void;
  onCreatePersonal?: () => void;
  onCreateTeam?: () => void;
}) {
  return (
    <CollapsibleSection
      sectionId={PERSONAL_SECTION_ID}
      title="Private & teams"
      icon={<User size={14} strokeWidth={1.75} />}
      hint="Your private scopes and personal teams. Documents can be shared with others."
      expanded={expanded}
      onToggle={onToggle}
    >
      <ul className="scope-menu__list">
        {personalPrivateScopes.map((scope) => (
          <ScopeListItem
            key={scope.id}
            scope={scope}
            activeScopeId={activeScopeId}
            icon={<Lock size={16} strokeWidth={1.75} />}
            meta="Private · only you"
            onSelect={onSelect}
          />
        ))}
        {personalTeamScopes.map((scope) => (
          <ScopeListItem
            key={scope.id}
            scope={scope}
            activeScopeId={activeScopeId}
            icon={<Users size={16} strokeWidth={1.75} className="scope-menu__item-icon--team" />}
            meta={`Team · ${roleLabels[scope.role]}`}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <div className="scope-menu__create-row">
        {canCreatePersonalSpace ? (
          <button type="button" className="scope-menu__create" onClick={onCreatePersonal}>
            <Plus size={16} strokeWidth={1.75} />
            New private scope
          </button>
        ) : (
          <p className="scope-menu__upgrade caption">
            Private scope limit reached. Upgrade for more.
          </p>
        )}
        {canCreateTeamSpace ? (
          <button type="button" className="scope-menu__create" onClick={onCreateTeam}>
            <Plus size={16} strokeWidth={1.75} />
            New team
          </button>
        ) : canCreatePersonalSpace ? (
          <p className="scope-menu__upgrade caption">
            Team limit reached. Upgrade for more.
          </p>
        ) : null}
      </div>
    </CollapsibleSection>
  );
}

function OrgSection({
  group,
  activeScopeId,
  expanded,
  onToggle,
  canCreateOrgTeam,
  onSelect,
  onCreateOrgTeam,
}: {
  group: OrgPickerGroup;
  activeScopeId: string;
  expanded: boolean;
  onToggle: (sectionId: string) => void;
  canCreateOrgTeam?: (org: Organization) => boolean;
  onSelect?: (scope: Scope) => void;
  onCreateOrgTeam?: (org: Organization) => void;
}) {
  const { org, teams } = group;
  const allowCreate = canCreateOrgTeam?.(org) ?? canManageOrgTeams(org);
  const sectionId = orgSectionId(org.id);

  return (
    <CollapsibleSection
      sectionId={sectionId}
      title={org.name}
      icon={<Building2 size={14} strokeWidth={1.75} />}
      hint="Organization teams — separate from your private world."
      expanded={expanded}
      onToggle={onToggle}
    >
      <ul className="scope-menu__list">
        {teams.length === 0 ? (
          <li className="scope-menu__empty caption">No teams in this organization yet.</li>
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
    </CollapsibleSection>
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
  menuOpen = true,
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () =>
      buildDefaultExpanded(
        activeScopeId,
        personalPrivateScopes,
        personalTeamScopes,
        orgGroups,
      ),
  );

  useEffect(() => {
    if (!menuOpen) return;
    setExpandedSections(
      buildDefaultExpanded(
        activeScopeId,
        personalPrivateScopes,
        personalTeamScopes,
        orgGroups,
      ),
    );
  }, [menuOpen, activeScopeId, personalPrivateScopes, personalTeamScopes, orgGroups]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  return (
    <div
      className={`scope-menu ${inline ? "scope-menu--inline" : ""} ${className}`.trim()}
      role="listbox"
      aria-label="Switch scope"
    >
      {userLabel ? (
        <header className="scope-menu__profile">
          {userId ? (
            <UserAvatar
              name={userLabel}
              userId={userId}
              src={userAvatarUrl}
              size="sm"
              className="scope-menu__profile-avatar"
            />
          ) : null}
          <span className="scope-menu__profile-name">{userLabel}</span>
        </header>
      ) : null}

      <div className="scope-menu__scroll overlay-scrollbar">
        <PersonalTeamsSection
          personalPrivateScopes={personalPrivateScopes}
          personalTeamScopes={personalTeamScopes}
          activeScopeId={activeScopeId}
          expanded={expandedSections[PERSONAL_SECTION_ID] ?? true}
          onToggle={toggleSection}
          canCreatePersonalSpace={canCreatePersonalSpace}
          canCreateTeamSpace={canCreateTeamSpace}
          onSelect={onSelect}
          onCreatePersonal={onCreatePersonal}
          onCreateTeam={onCreateTeam}
        />

        {orgGroups.length > 0 ? (
          <>
            <hr className="scope-menu__divider" />
            {orgGroups.map((group) => (
              <OrgSection
                key={group.org.id}
                group={group}
                activeScopeId={activeScopeId}
                expanded={expandedSections[orgSectionId(group.org.id)] ?? false}
                onToggle={toggleSection}
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
