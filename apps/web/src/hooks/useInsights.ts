"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isAskOllamaActive } from "@/lib/ollama-admission";

export type InsightMatch = {
  origin_type: string;
  item_id: string;
  source_ref_id: string;
  title: string;
  matched_text: string;
  page_ref: number | null;
  similarity: number;
  relevance_percent: number;
  location_label?: string;
  chunk_metadata?: Record<string, unknown> | null;
};

function friendlyInsightsError(raw: string | null | undefined): string {
  const message = (raw ?? "").toLowerCase();
  if (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("503") ||
    message.includes("ollama")
  ) {
    return "Rhodes is busy indexing — retry in a moment.";
  }
  if (!raw?.trim()) return "Couldn't load insights right now.";
  return raw;
}

export function useInsights(
  workspaceId: string | null,
  queryText: string,
  debounceMs = 3000,
) {
  const [insights, setInsights] = useState<InsightMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    setInsights([]);
    setError(null);
    setLoading(false);
    abortRef.current?.abort();
  }, [workspaceId]);

  const fetchInsights = useCallback(async () => {
    const query = queryText.trim();
    if (!workspaceId || query.length < 20) {
      setLoading(false);
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false);
      return;
    }

    if (pausedRef.current || isAskOllamaActive()) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/app/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          query_text: query.slice(-500),
        }),
        signal: controller.signal,
      });

      if (requestId !== requestIdRef.current) return;

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          friendlyInsightsError(
            typeof data.error === "string" ? data.error : "Failed to load insights",
          ),
        );
        setLoading(false);
        return;
      }

      setInsights((data.insights as InsightMatch[]) ?? []);
      setError(null);
      setLoading(false);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (requestId !== requestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load insights";
      setError(friendlyInsightsError(message));
      setLoading(false);
    }
  }, [queryText, workspaceId]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const query = queryText.trim();
    if (!workspaceId || query.length < 20) {
      setLoading(false);
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      void fetchInsights();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [debounceMs, fetchInsights, queryText, workspaceId]);

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    if (paused) {
      abortRef.current?.abort();
      setLoading(false);
    }
  }, []);

  return {
    insights,
    loading,
    error,
    refresh: fetchInsights,
    setPaused,
  };
}
