"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Organization, OrganizationRole } from "@/data/organizations";
import type { Scope } from "@/data/scopes";
import { createClient } from "@/lib/supabase/client";
import {
  membershipToScope,
  readActiveWorkspaceId,
  readDefaultScopeId,
  readScopesCache,
  writeActiveWorkspaceId,
  writeScopesCache,
} from "@/lib/workspaces/scope";

type MembershipRow = {
  workspace_id: string;
  role: string;
};

type WorkspaceRow = {
  id: string;
  name: string;
  is_team_workspace: boolean;
  org_id: string | null;
  created_at: string;
  enabled_views?: string[] | null;
};

type OrgMembershipRow = {
  role: string;
  organizations:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

type UseWorkspacesResult = {
  scopes: Scope[];
  organizations: Organization[];
  activeScopeId: string | null;
  loading: boolean;
  error: string | null;
  setActiveScopeId: (workspaceId: string) => void;
  refresh: () => Promise<void>;
  ensureWorkspace: () => Promise<Scope | null>;
};

const SCOPE_FETCH_TIMEOUT_MS = 8_000;

async function bootstrapWorkspace(): Promise<boolean> {
  const response = await fetch("/app/api/workspaces/bootstrap", {
    method: "POST",
  });
  return response.ok;
}

function roleRank(role: string): number {
  if (role === "owner") return 4;
  if (role === "admin") return 3;
  if (role === "member") return 2;
  if (role === "viewer") return 1;
  return 0;
}

function orgMembershipToOrganization(row: OrgMembershipRow): Organization | null {
  const org = Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations;
  if (!org) return null;

  const role = row.role as OrganizationRole;
  if (role !== "owner" && role !== "admin" && role !== "member") {
    return null;
  }

  return { id: org.id, name: org.name, role };
}

async function loadOrganizations(
  supabase: ReturnType<typeof createClient>,
): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name)");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => orgMembershipToOrganization(row as OrgMembershipRow))
    .filter((org): org is Organization => org !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mergeMemberships(
  memberships: MembershipRow[],
  workspaces: WorkspaceRow[],
): Scope[] {
  const workspaceById = new Map(workspaces.map((ws) => [ws.id, ws]));
  const bestMembershipByWorkspace = new Map<string, MembershipRow>();

  for (const row of memberships) {
    const existing = bestMembershipByWorkspace.get(row.workspace_id);
    if (!existing || roleRank(row.role) > roleRank(existing.role)) {
      bestMembershipByWorkspace.set(row.workspace_id, row);
    }
  }

  return Array.from(bestMembershipByWorkspace.values())
    .map((row) => {
      const workspace = workspaceById.get(row.workspace_id);
      if (!workspace) return null;
      return membershipToScope({ role: row.role, workspaces: workspace });
    })
    .filter((scope): scope is Scope => scope !== null)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "private" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function resolveScopesFromCache(): {
  scopes: Scope[];
  activeScopeId: string | null;
} | null {
  const cached = readScopesCache();
  if (cached) {
    const storedId = readActiveWorkspaceId();
    const validStored = cached.scopes.find((s) => s.id === storedId)?.id;
    const resolvedId =
      validStored ??
      cached.activeScopeId ??
      cached.scopes[0]?.id ??
      null;
    return { scopes: cached.scopes, activeScopeId: resolvedId };
  }

  const storedId = readActiveWorkspaceId();
  if (storedId) {
    return { scopes: [], activeScopeId: storedId };
  }

  return null;
}

function applyResolvedScopes(
  resolved: { scopes: Scope[]; activeScopeId: string | null },
  setScopes: (scopes: Scope[]) => void,
  setActiveScopeIdState: (id: string | null) => void,
) {
  setScopes(resolved.scopes);
  setActiveScopeIdState(resolved.activeScopeId);
  if (resolved.activeScopeId) {
    writeActiveWorkspaceId(resolved.activeScopeId);
  }
}

export function useWorkspaces(userId: string | undefined): UseWorkspacesResult {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeScopeId, setActiveScopeIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshGeneration = useRef(0);
  const hydratedFromCache = useRef(false);

  // Paint immediately from local scope cache before the network round-trip.
  useLayoutEffect(() => {
    if (hydratedFromCache.current) return;
    hydratedFromCache.current = true;
    const restored = resolveScopesFromCache();
    if (!restored) return;
    applyResolvedScopes(restored, setScopes, setActiveScopeIdState);
    if (restored.scopes.length > 0) {
      setLoading(false);
    }
  }, []);

  const loadScopes = useCallback(async (allowBootstrap: boolean) => {
    const supabase = createClient();

    const load = async (): Promise<{ scopes: Scope[]; organizations: Organization[] }> => {
      const [membershipResult, organizations] = await Promise.all([
        supabase.from("workspace_members").select("workspace_id, role"),
        loadOrganizations(supabase).catch(() => [] as Organization[]),
      ]);

      const { data: memberships, error: membershipError } = membershipResult;

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      let rows: MembershipRow[] = memberships ?? [];

      if (rows.length === 0 && allowBootstrap) {
        const bootstrapped = await bootstrapWorkspace();
        if (bootstrapped) {
          const retry = await supabase
            .from("workspace_members")
            .select("workspace_id, role");
          if (retry.error) {
            throw new Error(retry.error.message);
          }
          rows = (retry.data ?? []) as MembershipRow[];
        }
      }

      if (rows.length === 0) {
        return { scopes: [], organizations };
      }

      const workspaceIds = [...new Set(rows.map((row) => row.workspace_id))];
      const { data: workspaces, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id, name, is_team_workspace, org_id, created_at, enabled_views")
        .in("id", workspaceIds);

      if (workspaceError) {
        throw new Error(workspaceError.message);
      }

      return {
        scopes: mergeMemberships(rows, (workspaces ?? []) as WorkspaceRow[]),
        organizations,
      };
    };

    return Promise.race([
      load(),
      new Promise<{ scopes: Scope[]; organizations: Organization[] }>((_, reject) => {
        window.setTimeout(
          () => reject(new Error("Scope fetch timed out")),
          SCOPE_FETCH_TIMEOUT_MS,
        );
      }),
    ]);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setScopes([]);
      setOrganizations([]);
      setActiveScopeIdState(null);
      setLoading(false);
      setError(null);
      return;
    }

    const generation = ++refreshGeneration.current;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const restored = resolveScopesFromCache();
      if (restored) {
        applyResolvedScopes(restored, setScopes, setActiveScopeIdState);
        setLoading(false);
        setError(null);
        return;
      }
      setActiveScopeIdState(null);
      setLoading(false);
      setError("Scopes unavailable offline");
      return;
    }

    const showLoadingSpinner =
      scopes.length === 0 && resolveScopesFromCache() == null;
    if (showLoadingSpinner) {
      setLoading(true);
    }
    setError(null);

    try {
      const { scopes: nextScopes, organizations: nextOrganizations } =
        await loadScopes(true);
      if (generation !== refreshGeneration.current) return;

      setScopes(nextScopes);
      setOrganizations(nextOrganizations);

      const storedId = readActiveWorkspaceId();
      const defaultId = readDefaultScopeId();
      const validStored = nextScopes.find((s) => s.id === storedId)?.id;
      const validDefault = nextScopes.find((s) => s.id === defaultId)?.id;
      const fallbackId = nextScopes[0]?.id ?? null;
      const resolvedId = validStored ?? validDefault ?? fallbackId;

      setActiveScopeIdState(resolvedId);
      if (resolvedId) {
        writeActiveWorkspaceId(resolvedId);
      }
      writeScopesCache(nextScopes, resolvedId);
    } catch (err) {
      if (generation !== refreshGeneration.current) return;

      const message =
        err instanceof Error ? err.message : "Failed to load scopes";
      const restored = resolveScopesFromCache();
      if (restored) {
        applyResolvedScopes(restored, setScopes, setActiveScopeIdState);
        setError(null);
        return;
      }
      setError(message);
      setScopes([]);
      setActiveScopeIdState(null);
    } finally {
      if (generation === refreshGeneration.current) {
        setLoading(false);
      }
    }
  }, [userId, loadScopes]);

  const ensureWorkspace = useCallback(async () => {
    if (!userId) return null;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const restored = resolveScopesFromCache();
      if (restored) {
        applyResolvedScopes(restored, setScopes, setActiveScopeIdState);
        setError(null);
        return (
          restored.scopes.find((s) => s.id === restored.activeScopeId) ??
          restored.scopes[0] ??
          null
        );
      }
      const storedId = readActiveWorkspaceId();
      setActiveScopeIdState(storedId);
      setError(storedId ? null : "Scopes unavailable offline");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      let { scopes: nextScopes, organizations: nextOrganizations } =
        await loadScopes(true);

      if (nextScopes.length === 0) {
        const bootstrapped = await bootstrapWorkspace();
        if (!bootstrapped) {
          throw new Error("Couldn't create your private scope");
        }
        const reloaded = await loadScopes(false);
        nextScopes = reloaded.scopes;
        nextOrganizations = reloaded.organizations;
      }

      setScopes(nextScopes);
      setOrganizations(nextOrganizations);

      const storedId = readActiveWorkspaceId();
      const defaultId = readDefaultScopeId();
      const validStored = nextScopes.find((s) => s.id === storedId)?.id;
      const validDefault = nextScopes.find((s) => s.id === defaultId)?.id;
      const resolvedId =
        validStored ?? validDefault ?? nextScopes[0]?.id ?? null;

      setActiveScopeIdState(resolvedId);
      if (resolvedId) {
        writeActiveWorkspaceId(resolvedId);
      }
      writeScopesCache(nextScopes, resolvedId);

      return nextScopes.find((s) => s.id === resolvedId) ?? nextScopes[0] ?? null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to prepare scope";
      const restored = resolveScopesFromCache();
      if (restored) {
        applyResolvedScopes(restored, setScopes, setActiveScopeIdState);
        setError(null);
        return (
          restored.scopes.find((s) => s.id === restored.activeScopeId) ??
          restored.scopes[0] ??
          null
        );
      }
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, loadScopes]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onOffline = () => {
      refreshGeneration.current += 1;
      const restored = resolveScopesFromCache();
      if (!restored) return;
      applyResolvedScopes(restored, setScopes, setActiveScopeIdState);
      setLoading(false);
      setError(null);
    };
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, []);

  const setActiveScopeId = useCallback((workspaceId: string) => {
    setActiveScopeIdState(workspaceId);
    writeActiveWorkspaceId(workspaceId);
  }, []);

  return {
    scopes,
    organizations,
    activeScopeId,
    loading,
    error,
    setActiveScopeId,
    refresh,
    ensureWorkspace,
  };
}
