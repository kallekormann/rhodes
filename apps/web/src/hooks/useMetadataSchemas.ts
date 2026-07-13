"use client";

import { useCallback, useEffect, useState } from "react";
import { parseApiErrorMessage } from "@/lib/api/parse-error";
import type {
  MetadataFieldType,
  MetadataGroupField,
  MetadataSchemaField,
  MetadataSchemaGroup,
} from "@/lib/metadata/schemas";

function mapGroupFromApi(group: MetadataSchemaGroup): MetadataSchemaGroup {
  const rawFields = group.fields as Array<
    MetadataGroupField & { field_key?: string; sub_key?: string | null }
  >;

  return {
    ...group,
    fields: rawFields.map((field, index) => ({
      id: field.id,
      group_id: group.id,
      sub_key:
        field.sub_key ??
        (field.field_key
          ? field.field_key.replace(`${group.group_key}_`, "")
          : `field_${index}`),
      field_label: field.field_label,
      field_type: field.field_type,
      options: field.options,
      sort_order: field.sort_order ?? index,
      ai_fill_enabled: field.ai_fill_enabled ?? false,
    })),
  };
}

export function useMetadataSchemas(workspaceId: string | null) {
  const [schemas, setSchemas] = useState<MetadataSchemaField[]>([]);
  const [groups, setGroups] = useState<MetadataSchemaGroup[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setSchemas([]);
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ workspace_id: workspaceId });
    const response = await fetch(`/app/api/metadata-schemas?${params}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = parseApiErrorMessage(data, "Failed to load metadata schemas");
      setError(message);
      setSchemas([]);
      setGroups([]);
      setLoading(false);
      return;
    }

    setSchemas((data.schemas as MetadataSchemaField[]) ?? []);
    setGroups(
      ((data.groups as MetadataSchemaGroup[]) ?? []).map(mapGroupFromApi),
    );
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createSchema = useCallback(
    async (input: {
      field_label: string;
      field_type: MetadataFieldType;
      options?: string[] | { unit: string };
      field_key?: string;
      ai_fill_enabled?: boolean;
    }) => {
      if (!workspaceId) {
        return { ok: false as const, error: "No scope selected" };
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
        const message = parseApiErrorMessage(data, "Failed to add property");
        return { ok: false as const, error: message };
      }

      await refresh();
      return { ok: true as const, schema: data.schema as MetadataSchemaField };
    },
    [refresh, workspaceId],
  );

  const createGroup = useCallback(
    async (input: {
      group_label: string;
      repeatable?: boolean;
      fields: Array<{
        field_label: string;
        field_type: MetadataFieldType;
        sub_key?: string;
        options?: string[] | { unit: string };
        ai_fill_enabled?: boolean;
      }>;
    }) => {
      if (!workspaceId) {
        return { ok: false as const, error: "No scope selected" };
      }

      const response = await fetch("/app/api/metadata-schema-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...input,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = parseApiErrorMessage(data, "Failed to add property group");
        return { ok: false as const, error: message };
      }

      await refresh();
      return { ok: true as const, group: data.group as MetadataSchemaGroup };
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
        const message = parseApiErrorMessage(data, "Failed to delete property");
        return { ok: false as const, error: message };
      }

      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  const deleteGroup = useCallback(
    async (groupId: string, purgeValues = false) => {
      const params = purgeValues ? "?purge_values=true" : "";
      const response = await fetch(`/app/api/metadata-schema-groups/${groupId}${params}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = parseApiErrorMessage(data, "Failed to delete property group");
        return { ok: false as const, error: message };
      }

      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  const updateSchema = useCallback(
    async (
      schemaId: string,
      input: {
        field_label: string;
        field_type: MetadataFieldType;
        options?: string[] | { unit: string };
        ai_fill_enabled?: boolean;
      },
    ) => {
      const response = await fetch(`/app/api/metadata-schemas/${schemaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = parseApiErrorMessage(data, "Failed to update property");
        return { ok: false as const, error: message };
      }

      await refresh();
      return { ok: true as const, schema: data.schema as MetadataSchemaField };
    },
    [refresh],
  );

  const updateGroup = useCallback(
    async (
      groupId: string,
      input: {
        group_label: string;
        repeatable?: boolean;
        fields: Array<{
          id?: string;
          field_label: string;
          field_type: MetadataFieldType;
          sub_key?: string;
          options?: string[] | { unit: string };
          ai_fill_enabled?: boolean;
        }>;
      },
    ) => {
      const response = await fetch(`/app/api/metadata-schema-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = parseApiErrorMessage(data, "Failed to update property group");
        return { ok: false as const, error: message };
      }

      await refresh();
      return { ok: true as const, group: data.group as MetadataSchemaGroup };
    },
    [refresh],
  );

  return {
    schemas,
    groups,
    loading,
    error,
    refresh,
    createSchema,
    createGroup,
    updateSchema,
    updateGroup,
    deleteSchema,
    deleteGroup,
  };
}
