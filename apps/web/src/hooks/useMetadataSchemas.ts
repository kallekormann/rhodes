"use client";

import { useCallback, useEffect, useState } from "react";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";

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

  return { schemas, loading, error, refresh };
}
