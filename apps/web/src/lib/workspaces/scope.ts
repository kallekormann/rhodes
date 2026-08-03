import type { Scope, ScopeRole } from "@/data/scopes";

export const ACTIVE_WORKSPACE_KEY = "rhodes:active_workspace";
export const DEFAULT_SCOPE_KEY = "rhodes:default_scope";

type WorkspaceRow = {
  id: string;
  name: string;
  is_team_workspace: boolean;
  org_id?: string | null;
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
    orgId: workspace.org_id ?? null,
    createdAt: workspace.created_at,
    enabledViewsCount: workspace.enabled_views?.length ?? 0,
    enabledViews: workspace.enabled_views ?? [],
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

const SCOPES_CACHE_KEY = "rhodes:scopes_cache:v1";
const SCOPES_CACHE_LOCAL_KEY = "rhodes:scopes_cache:v1:local";

type ScopesCache = {
  scopes: Scope[];
  activeScopeId: string | null;
};

function parseScopesCache(raw: string | null): ScopesCache | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ScopesCache;
    if (!Array.isArray(parsed.scopes) || parsed.scopes.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readScopesCache(): ScopesCache | null {
  if (typeof window === "undefined") return null;
  return (
    parseScopesCache(window.sessionStorage.getItem(SCOPES_CACHE_KEY)) ??
    parseScopesCache(window.localStorage.getItem(SCOPES_CACHE_LOCAL_KEY))
  );
}

export function writeScopesCache(scopes: Scope[], activeScopeId: string | null) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ scopes, activeScopeId });
  window.sessionStorage.setItem(SCOPES_CACHE_KEY, payload);
  window.localStorage.setItem(SCOPES_CACHE_LOCAL_KEY, payload);
}
