import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TemplateSchemaFieldSeed,
  TemplateSchemaGroupSeed,
} from "@rhodes/shared/system-templates";
import { groupFieldKey } from "@rhodes/shared/system-templates";
import { parseTemplateMetadata } from "@/lib/templates/metadata";

export function schemaFieldsToSeedJson(
  fields: TemplateSchemaFieldSeed[],
): unknown[] {
  return fields.map((field) => ({
    field_key: field.field_key,
    field_label: field.field_label,
    field_type: field.field_type,
    ...(field.options != null ? { options: field.options } : {}),
    ...(typeof field.ai_fill_enabled === "boolean"
      ? { ai_fill_enabled: field.ai_fill_enabled }
      : {}),
  }));
}

export function schemaGroupsToSeedJson(
  groups: TemplateSchemaGroupSeed[],
): unknown[] {
  return groups.map((group) => ({
    group_key: group.group_key,
    group_label: group.group_label,
    repeatable: group.repeatable ?? false,
    fields: group.fields.map((field, index) => ({
      sub_key: field.sub_key,
      field_key: groupFieldKey(group.group_key, field.sub_key),
      field_label: field.field_label,
      field_type: field.field_type,
      sort_order: index,
      ...(field.options != null ? { options: field.options } : {}),
      ...(typeof field.ai_fill_enabled === "boolean"
        ? { ai_fill_enabled: field.ai_fill_enabled }
        : {}),
    })),
  }));
}

/** Idempotently seed Properties schema rows (+ groups) declared by a template. */
export async function seedTemplateSchemaFields(
  supabase: SupabaseClient,
  workspaceId: string,
  templateMetadata: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = parseTemplateMetadata(templateMetadata);
  const fields = parsed.schema_fields ?? [];
  const groups = parsed.schema_groups ?? [];

  if (fields.length > 0) {
    const { error } = await supabase.rpc("seed_scope_metadata_fields", {
      ws_id: workspaceId,
      fields: schemaFieldsToSeedJson(fields),
    });

    if (error) {
      return { ok: false, message: error.message };
    }
  }

  if (groups.length > 0) {
    const { error } = await supabase.rpc("seed_scope_metadata_groups", {
      ws_id: workspaceId,
      groups: schemaGroupsToSeedJson(groups),
    });

    if (error) {
      return { ok: false, message: error.message };
    }
  }

  return { ok: true };
}
