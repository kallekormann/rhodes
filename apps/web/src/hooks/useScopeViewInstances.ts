"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScopeViewInstanceRecord } from "@rhodes/shared/view-engine";

type UseScopeViewInstancesResult = {
  instances: ScopeViewInstanceRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useScopeViewInstances(
  workspaceId: string | null,
): UseScopeViewInstancesResult {
  const [instances, setInstances] = useState<ScopeViewInstanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setInstances([]);
      setError(null);
      setLoading(false);
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
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { instances, loading, error, refresh };
}
