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

export function useScopeViewInstances(
  workspaceId: string | null,
): UseScopeViewInstancesResult {
  const [instances, setInstances] = useState<ScopeViewInstanceRecord[]>([]);
  const [loading, setLoading] = useState(() => Boolean(workspaceId));
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setInstances([]);
      setError(null);
      setLoading(false);
      setHasLoaded(false);
      return;
    }

    setLoading(true);
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
      setInstances(
        Array.isArray(data.instances)
          ? (data.instances as ScopeViewInstanceRecord[])
          : [],
      );
    } catch (err) {
      setInstances([]);
      setError(err instanceof Error ? err.message : "Failed to load views");
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [workspaceId]);

  useEffect(() => {
    setHasLoaded(false);
    setInstances([]);
    void refresh();
  }, [refresh]);

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
      setInstances((current) =>
        current.map((instance) => (instance.id === updated.id ? updated : instance)),
      );
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
        return [...current, created];
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

      setInstances((current) =>
        current.filter((instance) => instance.id !== instanceId),
      );
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
