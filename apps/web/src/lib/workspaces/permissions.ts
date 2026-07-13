import type { Scope } from "@/data/scopes";
import {
  canManageTeamInvites,
  canRemoveTeamMember,
  canWriteTeamContent,
} from "@rhodes/shared/team-roles";

export function getInitialPersonalScopeId(personalScopes: Scope[]): string | null {
  if (personalScopes.length === 0) return null;

  return (
    [...personalScopes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.id ??
    null
  );
}

export function canRenameScope(scope: Scope): boolean {
  return scope.role === "owner" || scope.role === "admin";
}

export function canDeleteScope(scope: Scope, personalScopes: Scope[]): boolean {
  if (!canRenameScope(scope)) return false;

  if (scope.type === "team") return true;

  const initialId = getInitialPersonalScopeId(personalScopes);
  return scope.id !== initialId;
}

export function canWriteInScope(scope: Scope): boolean {
  if (scope.type === "private") return true;
  return canWriteTeamContent(scope.role);
}

export function canManageTeamMembers(scope: Scope): boolean {
  if (scope.type !== "team") return false;
  return canManageTeamInvites(scope.role);
}

export function canRemoveScopeMember(
  actorScope: Scope,
  targetRole: Scope["role"],
  actorUserId: string,
  targetUserId: string,
): boolean {
  if (actorScope.type !== "team") return false;
  return canRemoveTeamMember(
    actorScope.role,
    targetRole,
    actorUserId,
    targetUserId,
  );
}
