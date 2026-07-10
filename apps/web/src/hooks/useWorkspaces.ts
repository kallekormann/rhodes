"use client";

import { useCallback, useEffect, useState } from "react";
import type { Scope } from "@/data/scopes";
import { createClient } from "@/lib/supabase/client";
import {
  membershipToScope,
  readActiveWorkspaceId,
  writeActiveWorkspaceId,
} from "@/lib/workspaces/scope";

type UseWorkspacesResult = {
  scopes: Scope[];
  activeScopeId: string | null;
  loading: boolean;
  error: string | null;
  setActiveScopeId: (workspaceId: string) => void;
  refresh: () => Promise<void>;
};

export function useWorkspaces(userId: string | undefined): UseWorkspacesResult {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [activeScopeId, setActiveScopeIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setScopes([]);
      setActiveScopeIdState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("workspace_members")
      .select("role, workspaces(id, name, is_team_workspace)")
      .eq("user_id", userId);

    if (fetchError) {
      setError(fetchError.message);
      setScopes([]);
      setLoading(false);
      return;
    }

    const nextScopes = (data ?? [])
      .map((row) => membershipToScope(row))
      .filter((scope): scope is Scope => scope !== null)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "private" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    setScopes(nextScopes);

    const storedId = readActiveWorkspaceId();
    const validStored = nextScopes.find((s) => s.id === storedId)?.id;
    const fallbackId = nextScopes[0]?.id ?? null;
    const resolvedId = validStored ?? fallbackId;

    setActiveScopeIdState(resolvedId);
    if (resolvedId) {
      writeActiveWorkspaceId(resolvedId);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveScopeId = useCallback((workspaceId: string) => {
    setActiveScopeIdState(workspaceId);
    writeActiveWorkspaceId(workspaceId);
  }, []);

  return {
    scopes,
    activeScopeId,
    loading,
    error,
    setActiveScopeId,
    refresh,
  };
}
