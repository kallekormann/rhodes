"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScopeViewInstanceRecord } from "@rhodes/shared/view-engine";

type UseScopeViewInstancesResult = {
  instances: ScopeViewInstanceRecord[];
  loading: boolean;
  /** True after at least one fetch finished for the current workspace (success or error). */
  hasLoaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateInstance: (
    instanceId: string,
    input: {
      label?: string;
      config?: Record<string, unknown>;
      layout?: Record<string, { x: number; y: number }> | null;
    },
  ) => Promise<
    { ok: true; instance: ScopeViewInstanceRecord } | { ok: false; error: string }
  >;
  createInstance: (input: {
    base_view_type: string;
    label?: string;
    config?: Record<string, unknown>;
    layout?: Record<string, { x: number; y: number }>;
  }) => Promise<
    | { ok: true; instance: ScopeViewInstanceRecord }
    | { ok: false; error: string }
  >;
  deleteInstance: (
    instanceId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const viewInstanceCache = new Map<string, ScopeViewInstanceRecord[]>();

function writeViewInstanceCache(
  workspaceId: string,
  instances: ScopeViewInstanceRecord[],
) {
  viewInstanceCache.set(workspaceId, instances);
}

export function useScopeViewInstances(
  workspaceId: string | null,
): UseScopeViewInstancesResult {
  const cached = workspaceId ? viewInstanceCache.get(workspaceId) : undefined;
  const [instances, setInstances] = useState<ScopeViewInstanceRecord[]>(
    () => cached ?? [],
  );
  const [loading, setLoading] = useState(() => Boolean(workspaceId) && !cached);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(cached));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setInstances([]);
      setError(null);
      setLoading(false);
      setHasLoaded(false);
      return;
    }

    const hasCache = viewInstanceCache.has(workspaceId);
    if (!hasCache) setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/app/api/workspaces/${workspaceId}/view-instances`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to load views",
        );
      }
      const next = Array.isArray(data.instances)
        ? (data.instances as ScopeViewInstanceRecord[])
        : [];
      viewInstanceCache.set(workspaceId, next);
      setInstances(next);
    } catch (err) {
      if (!hasCache) setInstances([]);
      setError(err instanceof Error ? err.message : "Failed to load views");
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      setHasLoaded(false);
      setInstances([]);
      return;
    }
    const existing = viewInstanceCache.get(workspaceId);
    if (existing) {
      setInstances(existing);
      setHasLoaded(true);
      setLoading(false);
    } else {
      setHasLoaded(false);
      setInstances([]);
    }
    void refresh();
  }, [refresh, workspaceId]);

  const updateInstance = useCallback(
    async (
      instanceId: string,
      input: {
        label?: string;
        config?: Record<string, unknown>;
        layout?: Record<string, { x: number; y: number }> | null;
      },
    ) => {
      if (!workspaceId) {
        return { ok: false as const, error: "No scope selected" };
      }

      const response = await fetch(
        `/app/api/workspaces/${workspaceId}/view-instances/${instanceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Failed to update view";
        return { ok: false as const, error: message };
      }

      const updated = data.instance as ScopeViewInstanceRecord;
      setInstances((current) => {
        const next = current.map((instance) =>
          instance.id === updated.id ? updated : instance,
        );
        writeViewInstanceCache(workspaceId, next);
        return next;
      });
      return { ok: true as const, instance: updated };
    },
    [workspaceId],
  );

  const createInstance = useCallback(
    async (input: {
      base_view_type: string;
      label?: string;
      config?: Record<string, unknown>;
      layout?: Record<string, { x: number; y: number }>;
    }) => {
      if (!workspaceId) {
        return { ok: false as const, error: "No scope selected" };
      }

      const response = await fetch(
        `/app/api/workspaces/${workspaceId}/view-instances`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Failed to create view";
        return { ok: false as const, error: message };
      }

      const created = data.instance as ScopeViewInstanceRecord;
      setInstances((current) => {
        if (current.some((entry) => entry.id === created.id)) return current;
        const next = [...current, created];
        writeViewInstanceCache(workspaceId, next);
        return next;
      });
      return { ok: true as const, instance: created };
    },
    [workspaceId],
  );

  const deleteInstance = useCallback(
    async (instanceId: string) => {
      if (!workspaceId) {
        return { ok: false as const, error: "No scope selected" };
      }

      const response = await fetch(
        `/app/api/workspaces/${workspaceId}/view-instances/${instanceId}`,
        { method: "DELETE" },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Failed to delete view";
        return { ok: false as const, error: message };
      }

      setInstances((current) => {
        const next = current.filter((instance) => instance.id !== instanceId);
        writeViewInstanceCache(workspaceId, next);
        return next;
      });
      return { ok: true as const };
    },
    [workspaceId],
  );

  return {
    instances,
    loading,
    hasLoaded,
    error,
    refresh,
    updateInstance,
    createInstance,
    deleteInstance,
  };
}
