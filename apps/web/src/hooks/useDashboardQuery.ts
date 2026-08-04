"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardWidget } from "@rhodes/shared/view-engine";
import { parseApiErrorMessage } from "@/lib/api/parse-error";
import type { DashboardWidgetResult } from "@/lib/views/dashboard";

type UseDashboardQueryResult = {
  results: DashboardWidgetResult[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useDashboardQuery(
  workspaceId: string | null,
  widgets: DashboardWidget[],
): UseDashboardQueryResult {
  const [results, setResults] = useState<DashboardWidgetResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const widgetsKey = JSON.stringify(widgets);

  const refresh = useCallback(async () => {
    if (!workspaceId || widgets.length === 0) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/app/api/scopes/${workspaceId}/dashboard-query`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widgets }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          parseApiErrorMessage(data, "Failed to load dashboard data"),
        );
      }
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      setResults([]);
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
    // widgetsKey captures deep-equality of widgets without re-running on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, widgetsKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { results, loading, error, refresh };
}
