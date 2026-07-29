"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScopePolicy } from "@rhodes/shared/scope-policies";

type ScopePolicyResponse = {
  workspace_id: string;
  is_team_workspace: boolean;
  enabled_views: string[];
  policy: ScopePolicy;
  version?: number;
};

export function useScopePolicy(workspaceId: string | null) {
  const [data, setData] = useState<ScopePolicyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/app/api/workspaces/${workspaceId}/policy`);
      const body = (await response.json().catch(() => ({}))) as ScopePolicyResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Couldn't load scope settings");
      }
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load scope settings");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const savePolicy = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!workspaceId) return null;
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/app/api/workspaces/${workspaceId}/policy`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policy: patch }),
        });
        const body = (await response.json().catch(() => ({}))) as ScopePolicyResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error ?? "Couldn't save policy");
        }
        setData(body);
        return body.policy;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Couldn't save policy";
        setError(message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [workspaceId],
  );

  const saveEnabledViews = useCallback(
    async (enabledViews: string[]) => {
      if (!workspaceId) return false;
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/app/api/workspaces/${workspaceId}/policy`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled_views: enabledViews }),
        });
        const body = (await response.json().catch(() => ({}))) as ScopePolicyResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error ?? "Couldn't save views");
        }
        setData(body);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Couldn't save views";
        setError(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    saving,
    refresh,
    savePolicy,
    saveEnabledViews,
  };
}
