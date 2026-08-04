"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";
import type { ScopeViewInstanceRecord } from "@rhodes/shared/view-engine";
import { useScopeViewInstances } from "@/hooks/useScopeViewInstances";

export type ViewInstanceBaseType =
  | "kanban"
  | "dashboard"
  | "calendar"
  | "gantt"
  | "mindmap"
  | "graph";

function storageKey(workspaceId: string, baseViewType: string): string {
  return `rhodes:view-instance:${workspaceId}:${baseViewType}`;
}

function readStoredActiveId(
  workspaceId: string | null,
  baseViewType: string,
): string | null {
  if (!workspaceId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey(workspaceId, baseViewType));
  } catch {
    return null;
  }
}

function writeStoredActiveId(
  workspaceId: string,
  baseViewType: string,
  instanceId: string,
): void {
  try {
    window.localStorage.setItem(
      storageKey(workspaceId, baseViewType),
      instanceId,
    );
  } catch {
    // Ignore quota / private mode failures.
  }
}

function sortInstances(
  instances: ScopeViewInstanceRecord[],
): ScopeViewInstanceRecord[] {
  return [...instances].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function defaultLabelForViewType(baseViewType: string): string {
  return (
    ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === baseViewType)
      ?.label ?? baseViewType
  );
}

type UseViewInstancesOptions = {
  /** When false, skip loading mutations that require write access. Default true. */
  enabled?: boolean;
  canWrite?: boolean;
  defaultLabel?: string;
  onError?: (message: string) => void;
};

/**
 * Loads tabs for a page type. Boards are seeded when the page type is enabled
 * (composition apply) — this hook does not auto-create empty tabs on open.
 */
export function useViewInstances(
  workspaceId: string | null,
  baseViewType: ViewInstanceBaseType,
  options: UseViewInstancesOptions = {},
) {
  const {
    defaultLabel = defaultLabelForViewType(baseViewType),
    onError,
  } = options;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const reportError = useCallback((message: string) => {
    onErrorRef.current?.(message);
  }, []);

  const {
    instances: allInstances,
    loading,
    error,
    refresh,
    updateInstance,
    createInstance,
    deleteInstance,
  } = useScopeViewInstances(workspaceId);

  const instances = useMemo(
    () =>
      sortInstances(
        allInstances.filter(
          (instance) => instance.base_view_type === baseViewType,
        ),
      ),
    [allInstances, baseViewType],
  );

  const [activeId, setActiveIdState] = useState<string | null>(() =>
    readStoredActiveId(workspaceId, baseViewType),
  );

  const setActiveId = useCallback(
    (id: string) => {
      setActiveIdState(id);
      if (workspaceId) writeStoredActiveId(workspaceId, baseViewType, id);
    },
    [workspaceId, baseViewType],
  );

  // Keep selection valid when the instance list changes.
  useEffect(() => {
    if (instances.length === 0) {
      if (activeId !== null) setActiveIdState(null);
      return;
    }

    if (activeId && instances.some((instance) => instance.id === activeId)) {
      return;
    }

    const stored = readStoredActiveId(workspaceId, baseViewType);
    const fromStorage = stored
      ? instances.find((instance) => instance.id === stored)
      : undefined;
    const first = instances[0];
    if (!first) return;
    const next = fromStorage?.id ?? first.id;
    setActiveIdState(next);
    if (workspaceId) writeStoredActiveId(workspaceId, baseViewType, next);
  }, [instances, activeId, workspaceId, baseViewType]);

  const activeInstance = useMemo(
    () => instances.find((instance) => instance.id === activeId) ?? null,
    [instances, activeId],
  );

  const createTab = useCallback(
    async (label: string) => {
      const result = await createInstance({
        base_view_type: baseViewType,
        label: label.trim() || defaultLabel,
        config: {},
      });
      if (!result.ok) {
        reportError(result.error);
        return result;
      }
      setActiveId(result.instance.id);
      return result;
    },
    [createInstance, baseViewType, defaultLabel, reportError, setActiveId],
  );

  const deleteTab = useCallback(
    async (instanceId: string) => {
      if (instances.length <= 1) {
        const message = `Keep at least one ${defaultLabel.toLowerCase()}, or turn off ${defaultLabel} under Settings → Views.`;
        reportError(message);
        return { ok: false as const, error: message };
      }

      const index = instances.findIndex((instance) => instance.id === instanceId);
      const result = await deleteInstance(instanceId);
      if (!result.ok) {
        reportError(result.error);
        return result;
      }

      if (activeId === instanceId) {
        const remaining = instances.filter(
          (instance) => instance.id !== instanceId,
        );
        const neighbor =
          remaining[Math.min(index, remaining.length - 1)] ?? remaining[0];
        if (neighbor) setActiveId(neighbor.id);
      }

      return result;
    },
    [
      instances,
      defaultLabel,
      deleteInstance,
      reportError,
      activeId,
      setActiveId,
    ],
  );

  return {
    instances,
    activeId,
    activeInstance,
    setActiveId,
    loading,
    error,
    refresh,
    updateInstance,
    createInstance,
    createTab,
    deleteTab,
  };
}
