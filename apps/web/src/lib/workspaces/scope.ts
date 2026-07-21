import type { Scope, ScopeRole } from "@/data/scopes";

export const ACTIVE_WORKSPACE_KEY = "rhodes:active_workspace";
export const DEFAULT_SCOPE_KEY = "rhodes:default_scope";

type WorkspaceRow = {
  id: string;
  name: string;
  is_team_workspace: boolean;
  created_at: string;
  enabled_views?: string[] | null;
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
  if (
    role !== "owner" &&
    role !== "admin" &&
    role !== "member" &&
    role !== "viewer"
  ) {
    return null;
  }

  return {
    id: workspace.id,
    name: workspace.name,
    type: workspace.is_team_workspace ? "team" : "private",
    role,
    createdAt: workspace.created_at,
    enabledViewsCount: workspace.enabled_views?.length ?? 0,
  };
}

export function readActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

export function writeActiveWorkspaceId(workspaceId: string) {
  window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
}

export function readDefaultScopeId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEFAULT_SCOPE_KEY);
}

export function writeDefaultScopeId(scopeId: string) {
  window.localStorage.setItem(DEFAULT_SCOPE_KEY, scopeId);
}
