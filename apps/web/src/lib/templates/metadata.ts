import type { MetadataFieldValue } from "@/lib/metadata/schemas";
import type {
  TemplateCategoryId,
  TemplateSchemaFieldSeed,
  TemplateSchemaGroupSeed,
} from "@rhodes/shared/system-templates";
import { TEMPLATE_CATEGORY_CATALOG } from "@rhodes/shared/system-templates";

export type TemplateMetadata = {
  use_cases?: string[];
  document_type?: string;
  category?: TemplateCategoryId;
  supported_views?: string[];
  schema_fields?: TemplateSchemaFieldSeed[];
  schema_groups?: TemplateSchemaGroupSeed[];
  default_properties?: Record<string, MetadataFieldValue>;
};

const CATEGORY_IDS = new Set(
  TEMPLATE_CATEGORY_CATALOG.map((entry) => entry.id as string),
);

const FIELD_TYPES = new Set([
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
  "status",
  "relation",
]);

function isMetadataFieldValue(value: unknown): value is MetadataFieldValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === "string");
  }
  if (typeof value === "object") {
    const record = value as { start?: unknown; end?: unknown; document_id?: unknown };
    if ("document_id" in record) {
      return typeof record.document_id === "string";
    }
    return (
      ("start" in record || "end" in record) &&
      (record.start === null || typeof record.start === "string") &&
      (record.end === null || typeof record.end === "string")
    );
  }
  return false;
}

type StatusOptionSeedShape = {
  value: string;
  label: string;
  category: "unstarted" | "started" | "completed" | "canceled";
};

const STATUS_CATEGORY_VALUES = new Set(["unstarted", "started", "completed", "canceled"]);

function isStatusOptionSeed(value: unknown): value is StatusOptionSeedShape {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.value === "string" &&
    typeof record.label === "string" &&
    typeof record.category === "string" &&
    STATUS_CATEGORY_VALUES.has(record.category)
  );
}

function parseSchemaFields(raw: unknown): TemplateSchemaFieldSeed[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const fields: TemplateSchemaFieldSeed[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const field_key = typeof record.field_key === "string" ? record.field_key.trim() : "";
    const field_label =
      typeof record.field_label === "string" ? record.field_label.trim() : "";
    const field_type =
      typeof record.field_type === "string" && FIELD_TYPES.has(record.field_type)
        ? (record.field_type as TemplateSchemaFieldSeed["field_type"])
        : null;
    if (!field_key || !field_label || !field_type) continue;

    const options = Array.isArray(record.options)
      ? record.options.every(isStatusOptionSeed)
        ? (record.options as StatusOptionSeedShape[])
        : record.options.filter((item): item is string => typeof item === "string")
      : record.options === null
        ? null
        : record.options &&
            typeof record.options === "object" &&
            typeof (record.options as { unit?: unknown }).unit === "string"
          ? { unit: (record.options as { unit: string }).unit }
          : undefined;

    fields.push({
      field_key,
      field_label,
      field_type,
      ...(options !== undefined ? { options } : {}),
      ...(typeof record.ai_fill_enabled === "boolean"
        ? { ai_fill_enabled: record.ai_fill_enabled }
        : {}),
    });
  }

  return fields.length > 0 ? fields : undefined;
}

function parseSchemaGroups(raw: unknown): TemplateSchemaGroupSeed[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const groups: TemplateSchemaGroupSeed[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const group_key = typeof record.group_key === "string" ? record.group_key.trim() : "";
    const group_label =
      typeof record.group_label === "string" ? record.group_label.trim() : "";
    if (!group_key || !group_label || !Array.isArray(record.fields)) continue;

    const fields: TemplateSchemaGroupSeed["fields"] = [];
    for (const fieldEntry of record.fields) {
      if (!fieldEntry || typeof fieldEntry !== "object") continue;
      const field = fieldEntry as Record<string, unknown>;
      const sub_key = typeof field.sub_key === "string" ? field.sub_key.trim() : "";
      const field_label =
        typeof field.field_label === "string" ? field.field_label.trim() : "";
      const field_type =
        typeof field.field_type === "string" && FIELD_TYPES.has(field.field_type)
          ? (field.field_type as TemplateSchemaFieldSeed["field_type"])
          : null;
      if (!sub_key || !field_label || !field_type) continue;

      const options = Array.isArray(field.options)
        ? field.options.every(isStatusOptionSeed)
          ? (field.options as StatusOptionSeedShape[])
          : field.options.filter((item): item is string => typeof item === "string")
        : field.options === null
          ? null
          : field.options &&
              typeof field.options === "object" &&
              typeof (field.options as { unit?: unknown }).unit === "string"
            ? { unit: (field.options as { unit: string }).unit }
            : undefined;

      fields.push({
        sub_key,
        field_label,
        field_type,
        ...(options !== undefined ? { options } : {}),
        ...(typeof field.ai_fill_enabled === "boolean"
          ? { ai_fill_enabled: field.ai_fill_enabled }
          : {}),
      });
    }

    if (fields.length === 0) continue;
    groups.push({
      group_key,
      group_label,
      ...(typeof record.repeatable === "boolean" ? { repeatable: record.repeatable } : {}),
      fields,
    });
  }

  return groups.length > 0 ? groups : undefined;
}

export function parseTemplateMetadata(metadata: unknown): TemplateMetadata {
  if (!metadata || typeof metadata !== "object") return {};

  const record = metadata as Record<string, unknown>;
  const useCases = Array.isArray(record.use_cases)
    ? record.use_cases.filter((item): item is string => typeof item === "string")
    : undefined;

  let defaultProperties: Record<string, MetadataFieldValue> | undefined;
  if (record.default_properties && typeof record.default_properties === "object") {
    defaultProperties = {};
    for (const [key, value] of Object.entries(
      record.default_properties as Record<string, unknown>,
    )) {
      if (isMetadataFieldValue(value)) {
        defaultProperties[key] = value;
      }
    }
    if (Object.keys(defaultProperties).length === 0) defaultProperties = undefined;
  }

  const supportedViews = Array.isArray(record.supported_views)
    ? record.supported_views.filter((item): item is string => typeof item === "string")
    : undefined;

  const documentType =
    typeof record.document_type === "string" ? record.document_type : undefined;

  const category =
    typeof record.category === "string" && CATEGORY_IDS.has(record.category)
      ? (record.category as TemplateCategoryId)
      : undefined;

  return {
    use_cases: useCases,
    document_type: documentType,
    category,
    supported_views: supportedViews,
    schema_fields: parseSchemaFields(record.schema_fields),
    schema_groups: parseSchemaGroups(record.schema_groups),
    default_properties: defaultProperties,
  };
}

export function buildTemplateMetadata(input: TemplateMetadata): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (input.use_cases && input.use_cases.length > 0) {
    metadata.use_cases = input.use_cases;
  }
  if (input.document_type) {
    metadata.document_type = input.document_type;
  }
  if (input.category) {
    metadata.category = input.category;
  }
  if (input.supported_views && input.supported_views.length > 0) {
    metadata.supported_views = input.supported_views;
  }
  if (input.schema_fields && input.schema_fields.length > 0) {
    metadata.schema_fields = input.schema_fields;
  }
  if (input.schema_groups && input.schema_groups.length > 0) {
    metadata.schema_groups = input.schema_groups;
  }
  if (input.default_properties && Object.keys(input.default_properties).length > 0) {
    metadata.default_properties = input.default_properties;
  }

  return metadata;
}

/** Flatten template metadata into document.metadata defaults + classification. */
export function documentMetadataFromTemplate(
  templateMetadata: unknown,
  requestMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const parsed = parseTemplateMetadata(templateMetadata);
  const defaults = parsed.default_properties ?? {};

  return {
    ...defaults,
    ...(parsed.document_type ? { document_type: parsed.document_type } : {}),
    ...requestMetadata,
  };
}
