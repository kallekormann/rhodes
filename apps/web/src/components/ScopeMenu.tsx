import { Check, Lock, Plus, Settings, User, Users } from "lucide-react";
import type { Scope } from "@/data/scopes";
import { UserAvatar } from "@/components/UserAvatar";
import "./ScopeSwitcher.css";

import {
  ASSIGNABLE_TEAM_ROLES,
  TEAM_ROLE_LABELS,
} from "@rhodes/shared/team-roles";

const roleLabels = TEAM_ROLE_LABELS;

export type ScopeMenuProps = {
  personalScopes: Scope[];
  teamScopes: Scope[];
  activeScopeId: string;
  userLabel?: string;
  userAvatarUrl?: string | null;
  userId?: string;
  canCreatePersonalSpace?: boolean;
  canCreateTeamSpace?: boolean;
  onSelect?: (scope: Scope) => void;
  onCreatePersonal?: () => void;
  onCreateTeam?: () => void;
  onManage?: () => void;
  className?: string;
  inline?: boolean;
};

export function ScopeMenu({
  personalScopes,
  teamScopes,
  activeScopeId,
  userLabel,
  userAvatarUrl = null,
  userId,
  canCreatePersonalSpace = true,
  canCreateTeamSpace = true,
  onSelect,
  onCreatePersonal,
  onCreateTeam,
  onManage,
  className = "",
  inline = false,
}: ScopeMenuProps) {
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
            Only you. Separate projects, books, or research — each with its own library and AI.
          </p>
          <ul className="scope-menu__list">
            {personalScopes.map((scope) => (
              <li key={scope.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={activeScopeId === scope.id}
                  className={`scope-menu__item ${activeScopeId === scope.id ? "scope-menu__item--active" : ""}`}
                  onClick={() => onSelect?.(scope)}
                >
                  <Lock size={16} strokeWidth={1.75} className="scope-menu__item-icon" />
                  <span className="scope-menu__item-main">
                    <span className="scope-menu__item-name">{scope.name}</span>
                    <span className="scope-menu__item-meta">Personal · only you</span>
                  </span>
                  {activeScopeId === scope.id && (
                    <Check size={16} strokeWidth={1.75} className="scope-menu__check" />
                  )}
                </button>
              </li>
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

        <hr className="scope-menu__divider" />

        <section className="scope-menu__section">
          <header className="scope-menu__heading">
            <Users size={14} strokeWidth={1.75} />
            Team
          </header>
          <p className="scope-menu__hint">Shared docs and library for your team.</p>
          <ul className="scope-menu__list">
            {teamScopes.length === 0 ? (
              <li className="scope-menu__empty caption">No team scopes yet.</li>
            ) : (
              teamScopes.map((scope) => (
                <li key={scope.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeScopeId === scope.id}
                    className={`scope-menu__item ${activeScopeId === scope.id ? "scope-menu__item--active" : ""}`}
                    onClick={() => onSelect?.(scope)}
                  >
                    <Users
                      size={16}
                      strokeWidth={1.75}
                      className="scope-menu__item-icon scope-menu__item-icon--team"
                    />
                    <span className="scope-menu__item-main">
                      <span className="scope-menu__item-name">{scope.name}</span>
                      <span className="scope-menu__item-meta">
                        Team · {roleLabels[scope.role]}
                      </span>
                    </span>
                    {activeScopeId === scope.id && (
                      <Check size={16} strokeWidth={1.75} className="scope-menu__check" />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
          {canCreateTeamSpace ? (
            <button type="button" className="scope-menu__create" onClick={onCreateTeam}>
              <Plus size={16} strokeWidth={1.75} />
              New team scope
            </button>
          ) : (
            <p className="scope-menu__upgrade caption">
              Upgrade to Team plan to create team scopes.
            </p>
          )}
        </section>
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
