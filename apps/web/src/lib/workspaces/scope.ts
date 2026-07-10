import type { Scope, ScopeRole } from "@/data/scopes";

export const ACTIVE_WORKSPACE_KEY = "rhodes:active_workspace";

type WorkspaceRow = {
  id: string;
  name: string;
  is_team_workspace: boolean;
};

type MembershipRow = {
  role: string;
  workspaces: WorkspaceRow | WorkspaceRow[] | null;
};

export function membershipToScope(row: MembershipRow): Scope | null {
  const workspace = Array.isArray(row.workspaces)
    ? row.workspaces[0]
    : row.workspaces;

  if (!workspace) return null;

  const role = row.role as ScopeRole;
  if (role !== "owner" && role !== "admin" && role !== "member") {
    return null;
  }

  return {
    id: workspace.id,
    name: workspace.name,
    type: workspace.is_team_workspace ? "team" : "private",
    role,
  };
}

export function readActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

export function writeActiveWorkspaceId(workspaceId: string) {
  window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
}
