import type { PropertyPreset } from "@/lib/metadata/presets";
import type { PropertyGroupPreset } from "@/lib/metadata/group-presets";
import type { MetadataSchemaField, MetadataSchemaGroup } from "@/lib/metadata/schemas";

export function previewValueForFieldType(
  fieldType: MetadataSchemaField["field_type"],
  options?: string[],
) {
  switch (fieldType) {
    case "select":
      return options?.[0] ?? "option";
    case "multi_select":
    case "tags":
      return options?.slice(0, 2) ?? ["tag"];
    case "checkbox":
      return false;
    case "number":
      return 0;
    case "date":
      return null;
    case "date_range":
      return { start: null, end: null };
    case "textarea":
      return "";
    default:
      return "";
  }
}

export function fieldPresetToPreviewFields(preset: PropertyPreset) {
  return [
    {
      id: preset.label,
      field_label: preset.label,
      field_type: preset.field_type,
      options: preset.options ?? null,
    },
  ];
}

export function groupPresetToPreviewFields(preset: PropertyGroupPreset) {
  return preset.fields.map((field, index) => ({
    id: `${preset.group_label}-${index}`,
    field_label: field.field_label,
    field_type: field.field_type,
    options: field.options ?? (field.unit ? { unit: field.unit } : null),
  }));
}

export function schemaToPreviewFields(schema: MetadataSchemaField) {
  return [
    {
      id: schema.id,
      field_label: schema.field_label,
      field_type: schema.field_type,
      options: schema.options,
    },
  ];
}

export function groupToPreviewFields(group: MetadataSchemaGroup) {
  return group.fields.map((field) => ({
    id: field.id,
    field_label: field.field_label,
    field_type: field.field_type,
    options: field.options,
  }));
}
