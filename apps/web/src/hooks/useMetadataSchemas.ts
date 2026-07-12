"use client";

import { useCallback, useEffect, useState } from "react";
import type { MetadataFieldType, MetadataSchemaField } from "@/lib/metadata/schemas";

export function useMetadataSchemas(workspaceId: string | null) {
  const [schemas, setSchemas] = useState<MetadataSchemaField[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setSchemas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ workspace_id: workspaceId });
    const response = await fetch(`/app/api/metadata-schemas?${params}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(
        typeof data.error === "string" ? data.error : "Failed to load metadata schemas",
      );
      setSchemas([]);
      setLoading(false);
      return;
    }

    setSchemas((data.schemas as MetadataSchemaField[]) ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createSchema = useCallback(
    async (input: {
      field_label: string;
      field_type: MetadataFieldType;
      options?: string[];
      field_key?: string;
    }) => {
      if (!workspaceId) {
        return { ok: false as const, error: "No workspace selected" };
      }

      const response = await fetch("/app/api/metadata-schemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...input,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Failed to add property";
        setError(message);
        return { ok: false as const, error: message };
      }

      await refresh();
      return { ok: true as const, schema: data.schema as MetadataSchemaField };
    },
    [refresh, workspaceId],
  );

  const deleteSchema = useCallback(
    async (schemaId: string, purgeValues = false) => {
      const params = purgeValues ? "?purge_values=true" : "";
      const response = await fetch(`/app/api/metadata-schemas/${schemaId}${params}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data.error === "string" ? data.error : "Failed to delete property";
        setError(message);
        return { ok: false as const, error: message };
      }

      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  return { schemas, loading, error, refresh, createSchema, deleteSchema };
}
