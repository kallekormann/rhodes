import { z } from "zod";
import {
  fieldKeyFromLabel,
  groupFieldKey,
  isReservedMetadataKey,
  subKeyFromLabel,
  type MetadataFieldType,
} from "@/lib/metadata/schemas";

export const metadataFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "select",
  "multi_select",
  "date",
  "date_range",
  "tags",
  "number",
  "url",
  "checkbox",
]);

export const createMetadataSchemaInput = z.object({
  workspace_id: z.string().uuid(),
  field_label: z.string().min(1).max(80),
  field_type: metadataFieldTypeSchema,
  field_key: z.string().min(1).max(48).optional(),
  ai_fill_enabled: z.boolean().optional(),
  options: z.union([
    z.array(z.string().min(1).max(80)),
    z.object({ unit: z.string().max(12) }),
  ]).nullish(),
});

export const createMetadataGroupFieldInput = z.object({
  field_label: z.string().min(1).max(80),
  field_type: metadataFieldTypeSchema,
  sub_key: z.string().min(1).max(32).optional(),
  ai_fill_enabled: z.boolean().optional(),
  options: z.union([
    z.array(z.string().min(1).max(80)),
    z.object({ unit: z.string().max(12) }),
  ]).nullish(),
  sort_order: z.number().int().min(0).optional(),
});

export const createMetadataGroupInput = z.object({
  workspace_id: z.string().uuid(),
  group_label: z.string().min(1).max(80),
  group_key: z.string().min(1).max(48).optional(),
  repeatable: z.boolean().optional(),
  fields: z.array(createMetadataGroupFieldInput).min(1).max(12),
});

export const updateMetadataSchemaInput = z.object({
  field_label: z.string().min(1).max(80),
  field_type: metadataFieldTypeSchema,
  options: z.union([
    z.array(z.string().min(1).max(80)),
    z.object({ unit: z.string().max(12) }),
  ]).nullish(),
  ai_fill_enabled: z.boolean().optional(),
});

export const updateMetadataGroupFieldInput = createMetadataGroupFieldInput.extend({
  id: z.string().uuid().optional(),
});

export const updateMetadataGroupInput = z.object({
  group_label: z.string().min(1).max(80),
  repeatable: z.boolean().optional(),
  fields: z.array(updateMetadataGroupFieldInput).min(1).max(12),
});

export function normalizeUpdateMetadataSchemaInput(
  input: z.infer<typeof updateMetadataSchemaInput>,
) {
  const needsOptions =
    input.field_type === "select" || input.field_type === "multi_select";

  if (needsOptions && (!Array.isArray(input.options) || input.options.length === 0)) {
    throw new Error("Select fields require at least one option");
  }

  return {
    field_label: input.field_label.trim(),
    field_type: input.field_type as MetadataFieldType,
    options: needsOptions ? input.options : input.options ?? null,
    ai_fill_enabled: input.ai_fill_enabled ?? false,
  };
}

export function normalizeUpdateMetadataGroupInput(
  groupKey: string,
  input: z.infer<typeof updateMetadataGroupInput>,
) {
  const usedSubKeys = new Set<string>();
  const fields = input.fields.map((field, index) => {
    const sub_key = (field.sub_key ?? subKeyFromLabel(field.field_label)).toLowerCase();
    if (usedSubKeys.has(sub_key)) {
      throw new Error(`Duplicate sub-property key "${sub_key}" in group`);
    }
    usedSubKeys.add(sub_key);

    const field_key = groupFieldKey(groupKey, sub_key);
    const needsOptions =
      field.field_type === "select" || field.field_type === "multi_select";

    if (needsOptions && (!Array.isArray(field.options) || field.options.length === 0)) {
      throw new Error(`"${field.field_label}" requires at least one option`);
    }

    return {
      id: field.id,
      field_label: field.field_label.trim(),
      sub_key,
      field_key,
      field_type: field.field_type as MetadataFieldType,
      options: needsOptions ? field.options : field.options ?? null,
      sort_order: field.sort_order ?? index,
      ai_fill_enabled: field.ai_fill_enabled ?? false,
    };
  });

  return {
    group_label: input.group_label.trim(),
    repeatable: input.repeatable ?? true,
    fields,
  };
}

export function normalizeCreateMetadataSchemaInput(
  input: z.infer<typeof createMetadataSchemaInput>,
) {
  const field_key = (input.field_key ?? fieldKeyFromLabel(input.field_label)).toLowerCase();

  if (isReservedMetadataKey(field_key)) {
    throw new Error(`"${field_key}" is a reserved property key`);
  }

  const needsOptions =
    input.field_type === "select" || input.field_type === "multi_select";

  if (needsOptions && (!Array.isArray(input.options) || input.options.length === 0)) {
    throw new Error("Select fields require at least one option");
  }

  return {
    workspace_id: input.workspace_id,
    field_label: input.field_label.trim(),
    field_key,
    field_type: input.field_type as MetadataFieldType,
    options: needsOptions ? input.options : input.options ?? null,
    ai_fill_enabled: input.ai_fill_enabled ?? false,
  };
}

export function normalizeCreateMetadataGroupInput(
  input: z.infer<typeof createMetadataGroupInput>,
) {
  const group_key = (input.group_key ?? fieldKeyFromLabel(input.group_label)).toLowerCase();

  if (isReservedMetadataKey(group_key)) {
    throw new Error(`"${group_key}" is a reserved property key`);
  }

  const usedSubKeys = new Set<string>();
  const fields = input.fields.map((field, index) => {
    const sub_key = (field.sub_key ?? subKeyFromLabel(field.field_label)).toLowerCase();
    if (usedSubKeys.has(sub_key)) {
      throw new Error(`Duplicate sub-property key "${sub_key}" in group`);
    }
    usedSubKeys.add(sub_key);

    const field_key = groupFieldKey(group_key, sub_key);
    const needsOptions =
      field.field_type === "select" || field.field_type === "multi_select";

    if (needsOptions && (!Array.isArray(field.options) || field.options.length === 0)) {
      throw new Error(`"${field.field_label}" requires at least one option`);
    }

    return {
      field_label: field.field_label.trim(),
      sub_key,
      field_key,
      field_type: field.field_type as MetadataFieldType,
      options: needsOptions ? field.options : field.options ?? null,
      sort_order: field.sort_order ?? index,
      ai_fill_enabled: field.ai_fill_enabled ?? false,
    };
  });

  return {
    workspace_id: input.workspace_id,
    group_label: input.group_label.trim(),
    group_key,
    repeatable: input.repeatable ?? true,
    fields,
  };
}
