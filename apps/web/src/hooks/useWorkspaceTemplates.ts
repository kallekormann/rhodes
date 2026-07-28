"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TemplateFilter } from "@/hooks/useTemplates";
import {
  fetchWorkspaceTemplates,
  readCachedWorkspaceTemplates,
} from "@/lib/templates/fetch-workspace-templates";

/** App-scoped template list — survives DocumentsView remounts. */
export function useWorkspaceTemplates(
  workspaceId: string | null,
  filter: TemplateFilter = "all",
  online: boolean = true,
) {
  const cached = readCachedWorkspaceTemplates(workspaceId, filter);
  const [templates, setTemplates] = useState(
    () => cached ?? [],
  );
  const [loading, setLoading] = useState(
    () => !cached && Boolean(workspaceId),
  );
  const [error, setError] = useState<string | null>(null);
  const templatesRef = useRef(templates);
  templatesRef.current = templates;

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setTemplates([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false);
      setError(null);
      return;
    }

    const showLoadingState = templatesRef.current.length === 0;
    if (showLoadingState) {
      setLoading(true);
    }
    setError(null);

    try {
      const next = await fetchWorkspaceTemplates(workspaceId, filter);
      setTemplates(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load templates",
      );
      if (showLoadingState) {
        setTemplates([]);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !online) return;
    void refresh();
  }, [online, refresh, workspaceId]);

  return { templates, loading, error, refresh };
}
