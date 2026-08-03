import type { MetadataFieldValue } from "@/lib/metadata/schemas";
import type { TemplateSchemaFieldSeed } from "@rhodes/shared/system-templates";

export type TemplateMetadata = {
  use_cases?: string[];
  document_type?: string;
  supported_views?: string[];
  schema_fields?: TemplateSchemaFieldSeed[];
  default_properties?: Record<string, MetadataFieldValue>;
};

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
    const range = value as { start?: unknown; end?: unknown };
    return (
      ("start" in range || "end" in range) &&
      (range.start === null || typeof range.start === "string") &&
      (range.end === null || typeof range.end === "string")
    );
  }
  return false;
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
      ? record.options.filter((item): item is string => typeof item === "string")
      : record.options === null
        ? null
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

  return {
    use_cases: useCases,
    document_type: documentType,
    supported_views: supportedViews,
    schema_fields: parseSchemaFields(record.schema_fields),
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
  if (input.supported_views && input.supported_views.length > 0) {
    metadata.supported_views = input.supported_views;
  }
  if (input.schema_fields && input.schema_fields.length > 0) {
    metadata.schema_fields = input.schema_fields;
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
