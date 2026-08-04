"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScopePolicy } from "@rhodes/shared/scope-policies";
import type { ScopeCompositionBody } from "@/lib/scope-composition/apply";
import { createTimedCache, isCacheFresh } from "@/lib/cache/swr-cache";

function isResolvableWorkspaceId(id: string | null | undefined): id is string {
  return Boolean(id) && id !== "loading";
}

export type ScopePolicyResponse = {
  workspace_id: string;
  is_team_workspace: boolean;
  enabled_views: string[];
  bundle_ids: string[];
  setup_config: Record<string, unknown>;
  policy: ScopePolicy;
  version?: number;
};

const policyCache = createTimedCache<ScopePolicyResponse>();

async function fetchScopePolicy(workspaceId: string): Promise<ScopePolicyResponse> {
  const response = await fetch(`/app/api/workspaces/${workspaceId}/policy`);
  const body = (await response.json().catch(() => ({}))) as ScopePolicyResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error ?? "Couldn't load scope settings");
  }
  return body;
}

function writePolicyCache(workspaceId: string, data: ScopePolicyResponse) {
  policyCache.set(workspaceId, data);
}

export function useScopePolicy(workspaceId: string | null) {
  const resolvedId = isResolvableWorkspaceId(workspaceId) ? workspaceId : null;
  const cached = resolvedId ? policyCache.get(resolvedId) : undefined;
  const [data, setData] = useState<ScopePolicyResponse | null>(
    () => cached?.value ?? null,
  );
  const [loading, setLoading] = useState(
    () => Boolean(resolvedId) && !cached,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!resolvedId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const hit = policyCache.get(resolvedId);
    if (hit) {
      setData(hit.value);
      setLoading(false);
      if (isCacheFresh(hit.fetchedAt)) {
        return;
      }
    } else {
      setLoading(true);
    }
    setError(null);

    void policyCache
      .getOrFetch(resolvedId, () => fetchScopePolicy(resolvedId), {
        force: !hit,
      })
      .then(({ value }) => {
        if (!cancelled) {
          setData(value);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Couldn't load scope settings",
          );
          if (!hit) setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedId]);

  const savePolicy = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!resolvedId) return null;
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/app/api/workspaces/${resolvedId}/policy`, {
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
        writePolicyCache(resolvedId, body);
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
    [resolvedId],
  );

  const saveScopeComposition = useCallback(
    async (scopeComposition: ScopeCompositionBody) => {
      if (!resolvedId) return false;
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/app/api/workspaces/${resolvedId}/policy`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope_composition: scopeComposition }),
        });
        const body = (await response.json().catch(() => ({}))) as ScopePolicyResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error ?? "Couldn't save scope composition");
        }
        writePolicyCache(resolvedId, body);
        setData(body);
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Couldn't save scope composition";
        setError(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [resolvedId],
  );

  const refresh = useCallback(async () => {
    if (!resolvedId) return;
    setLoading(true);
    setError(null);
    try {
      const { value } = await policyCache.getOrFetch(
        resolvedId,
        () => fetchScopePolicy(resolvedId),
        { force: true },
      );
      setData(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load scope settings");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  return {
    data,
    loading,
    error,
    saving,
    refresh,
    savePolicy,
    saveScopeComposition,
    ready: resolvedId !== null && !loading && data !== null,
  };
}
