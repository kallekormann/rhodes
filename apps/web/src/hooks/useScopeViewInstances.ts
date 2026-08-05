"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  MindMapLayout,
  MindMapLayoutV1,
  ScopeViewInstanceRecord,
  WikiLayout,
} from "@rhodes/shared/view-engine";
import { isCacheFresh } from "@/lib/cache/swr-cache";

type ViewInstanceLayout = MindMapLayout | MindMapLayoutV1 | WikiLayout | null;

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
      layout?: ViewInstanceLayout;
    },
  ) => Promise<
    { ok: true; instance: ScopeViewInstanceRecord } | { ok: false; error: string }
  >;
  createInstance: (input: {
    base_view_type: string;
    label?: string;
    config?: Record<string, unknown>;
    layout?: ViewInstanceLayout;
  }) => Promise<
    | { ok: true; instance: ScopeViewInstanceRecord }
    | { ok: false; error: string }
  >;
  deleteInstance: (
    instanceId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

type ViewInstanceCacheEntry = {
  instances: ScopeViewInstanceRecord[];
  fetchedAt: number;
};

const viewInstanceCache = new Map<string, ViewInstanceCacheEntry>();
const viewInstanceInFlight = new Map<string, Promise<ViewInstanceCacheEntry>>();

function writeViewInstanceCache(
  workspaceId: string,
  instances: ScopeViewInstanceRecord[],
) {
  viewInstanceCache.set(workspaceId, {
    instances,
    fetchedAt: Date.now(),
  });
}

async function fetchViewInstances(
  workspaceId: string,
): Promise<ViewInstanceCacheEntry> {
  const pending = viewInstanceInFlight.get(workspaceId);
  if (pending) return pending;

  const job = (async () => {
    const response = await fetch(
      `/app/api/workspaces/${workspaceId}/view-instances`,
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof data.error === "string" ? data.error : "Failed to load views",
      );
    }
    const instances = Array.isArray(data.instances)
      ? (data.instances as ScopeViewInstanceRecord[])
      : [];
    const entry = { instances, fetchedAt: Date.now() };
    viewInstanceCache.set(workspaceId, entry);
    return entry;
  })();

  viewInstanceInFlight.set(workspaceId, job);
  try {
    return await job;
  } finally {
    viewInstanceInFlight.delete(workspaceId);
  }
}

export function useScopeViewInstances(
  workspaceId: string | null,
): UseScopeViewInstancesResult {
  const cached = workspaceId ? viewInstanceCache.get(workspaceId) : undefined;
  const [instances, setInstances] = useState<ScopeViewInstanceRecord[]>(
    () => cached?.instances ?? [],
  );
  const [loading, setLoading] = useState(() => Boolean(workspaceId) && !cached);
  const [hasLoaded, setHasLoaded] = useState(() => Boolean(cached));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
      if (!workspaceId) {
        setInstances([]);
        setError(null);
        setLoading(false);
        setHasLoaded(false);
        return;
      }

      const hit = viewInstanceCache.get(workspaceId);
      if (hit && !options?.force && isCacheFresh(hit.fetchedAt)) {
        setInstances(hit.instances);
        setLoading(false);
        setHasLoaded(true);
        setError(null);
        return;
      }

      if (!hit) setLoading(true);
      setError(null);
      try {
        if (options?.force) viewInstanceInFlight.delete(workspaceId);
        const entry = await fetchViewInstances(workspaceId);
        setInstances(entry.instances);
      } catch (err) {
        if (!hit) setInstances([]);
        setError(err instanceof Error ? err.message : "Failed to load views");
      } finally {
        setLoading(false);
        setHasLoaded(true);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!workspaceId) {
      setHasLoaded(false);
      setInstances([]);
      return;
    }
    const existing = viewInstanceCache.get(workspaceId);
    if (existing) {
      setInstances(existing.instances);
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
        layout?: ViewInstanceLayout;
      },
    ) => {
      if (!workspaceId) {
        return { ok: false as const, error: "No scope selected" };
      }

      let snapshot: ScopeViewInstanceRecord[] | null = null;
      setInstances((current) => {
        snapshot = current;
        const next = current.map((instance) => {
          if (instance.id !== instanceId) return instance;
          return {
            ...instance,
            ...(input.label !== undefined ? { label: input.label } : {}),
            ...(input.config !== undefined ? { config: input.config } : {}),
            ...(input.layout !== undefined ? { layout: input.layout } : {}),
          };
        });
        writeViewInstanceCache(workspaceId, next);
        return next;
      });

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
        if (snapshot) {
          setInstances(snapshot);
          writeViewInstanceCache(workspaceId, snapshot);
        }
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
      layout?: ViewInstanceLayout;
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
    refresh: () => refresh({ force: true }),
    updateInstance,
    createInstance,
    deleteInstance,
  };
}
