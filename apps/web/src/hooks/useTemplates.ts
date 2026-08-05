"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchWorkspaceTemplates,
  readCachedWorkspaceTemplates,
} from "@/lib/templates/fetch-workspace-templates";

export type TemplateRecord = {
  id: string;
  workspace_id: string | null;
  created_by: string | null;
  name: string;
  description: string | null;
  metadata?: Record<string, unknown> | null;
  is_system: boolean;
  is_shared: boolean;
  slug?: string | null;
  created_at: string;
};

export type TemplateDetail = TemplateRecord & {
  structure_json: Record<string, unknown>;
};

export type TemplateFilter = "all" | "mine";

export function useTemplates(
  workspaceId: string | null,
  filter: TemplateFilter = "all",
) {
  const cached = readCachedWorkspaceTemplates(workspaceId, filter);
  const [templates, setTemplates] = useState<TemplateRecord[]>(
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
      const nextTemplates = await fetchWorkspaceTemplates(workspaceId, filter);
      setTemplates(nextTemplates);
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
  }, [workspaceId, filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { templates, loading, error, refresh };
}

export async function createTemplate(input: {
  workspaceId: string;
  name: string;
  description?: string;
  structureJson: Record<string, unknown>;
  sourceDocumentId?: string;
}) {
  const response = await fetch("/app/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspace_id: input.workspaceId,
      name: input.name,
      description: input.description,
      structure_json: input.structureJson,
      source_document_id: input.sourceDocumentId,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to create template",
    );
  }

  return data.template as TemplateRecord;
}

export async function fetchTemplate(templateId: string): Promise<TemplateDetail> {
  const response = await fetch(`/app/api/templates/${templateId}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to load template",
    );
  }

  return data.template as TemplateDetail;
}

export async function updateTemplate(input: {
  id: string;
  name?: string;
  description?: string;
  structureJson?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const response = await fetch(`/app/api/templates/${input.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      structure_json: input.structureJson,
      metadata: input.metadata,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to update template",
    );
  }

  return data.template as TemplateDetail;
}

export async function deleteTemplate(templateId: string) {
  const response = await fetch(`/app/api/templates/${templateId}`, {
    method: "DELETE",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to delete template",
    );
  }
}
