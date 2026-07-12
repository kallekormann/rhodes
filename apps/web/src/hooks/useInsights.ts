"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type InsightMatch = {
  origin_type: string;
  item_id: string;
  title: string;
  matched_text: string;
  page_ref: number | null;
  similarity: number;
  relevance_percent: number;
};

export function useInsights(
  workspaceId: string | null,
  queryText: string,
  debounceMs = 3000,
) {
  const [insights, setInsights] = useState<InsightMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInsights = useCallback(async () => {
    const query = queryText.trim();
    if (!workspaceId || query.length < 20) {
      setInsights([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch("/app/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        query_text: query.slice(-500),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to load insights");
      setInsights([]);
      setLoading(false);
      return;
    }

    setInsights((data.insights as InsightMatch[]) ?? []);
    setLoading(false);
  }, [queryText, workspaceId]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      void fetchInsights();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [debounceMs, fetchInsights]);

  return { insights, loading, error, refresh: fetchInsights };
}
