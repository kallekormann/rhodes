export type TeamRole = "owner" | "admin" | "member" | "viewer";

/** Roles that can be assigned when inviting or editing members (not owner). */
export type AssignableTeamRole = "admin" | "member" | "viewer";

export type TeamCapability =
  | "team.invite"
  | "team.cancel_invite"
  | "team.remove_member"
  | "team.change_role"
  | "team.assign_admin"
  | "content.write"
  | "content.read";

const CAPABILITIES: Record<TeamRole, ReadonlySet<TeamCapability>> = {
  owner: new Set([
    "team.invite",
    "team.cancel_invite",
    "team.remove_member",
    "team.change_role",
    "team.assign_admin",
    "content.write",
    "content.read",
  ]),
  admin: new Set([
    "team.invite",
    "team.cancel_invite",
    "team.remove_member",
    "team.change_role",
    "content.write",
    "content.read",
  ]),
  member: new Set(["content.write", "content.read"]),
  viewer: new Set(["content.read"]),
};

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export const ASSIGNABLE_TEAM_ROLES: AssignableTeamRole[] = [
  "admin",
  "member",
  "viewer",
];

export function isTeamRole(value: string): value is TeamRole {
  return value === "owner" || value === "admin" || value === "member" || value === "viewer";
}

export function hasTeamCapability(
  role: TeamRole | string | undefined,
  capability: TeamCapability,
): boolean {
  if (!role || !isTeamRole(role)) return false;
  return CAPABILITIES[role].has(capability);
}

export function canWriteTeamContent(role: TeamRole | string | undefined): boolean {
  return hasTeamCapability(role, "content.write");
}

export function assignableRolesForActor(
  actorRole: TeamRole | string | undefined,
): AssignableTeamRole[] {
  if (actorRole === "owner") return [...ASSIGNABLE_TEAM_ROLES];
  if (actorRole === "admin") return ["member", "viewer"];
  return [];
}

export function canChangeMemberRole(
  actorRole: TeamRole | string | undefined,
  targetRole: TeamRole | string | undefined,
  nextRole: AssignableTeamRole,
): boolean {
  if (!actorRole || !targetRole || !isTeamRole(actorRole) || !isTeamRole(targetRole)) {
    return false;
  }
  if (targetRole === "owner") return false;
  if (!hasTeamCapability(actorRole, "team.change_role")) return false;

  const allowed = assignableRolesForActor(actorRole);
  if (!allowed.includes(nextRole)) return false;

  if (actorRole === "admin" && targetRole === "admin") return false;
  return true;
}

export function canRemoveTeamMember(
  actorRole: TeamRole | string | undefined,
  targetRole: TeamRole | string | undefined,
  actorUserId: string,
  targetUserId: string,
): boolean {
  if (!hasTeamCapability(actorRole, "team.remove_member")) return false;
  if (actorUserId === targetUserId) return false;
  if (targetRole === "owner") return false;
  if (actorRole === "admin" && targetRole === "admin") return false;
  return true;
}

export function canManageTeamInvites(role: TeamRole | string | undefined): boolean {
  return hasTeamCapability(role, "team.invite");
}
