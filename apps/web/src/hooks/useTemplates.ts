"use client";

import { useCallback, useEffect, useState } from "react";

export type TemplateRecord = {
  id: string;
  workspace_id: string | null;
  created_by: string | null;
  name: string;
  description: string | null;
  metadata?: Record<string, unknown> | null;
  is_system: boolean;
  is_shared: boolean;
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
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      workspace_id: workspaceId,
      filter,
    });

    const response = await fetch(`/app/api/templates?${params}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(
        typeof data.error === "string" ? data.error : "Failed to load templates",
      );
      setTemplates([]);
      setLoading(false);
      return;
    }

    setTemplates((data.templates as TemplateRecord[]) ?? []);
    setLoading(false);
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
