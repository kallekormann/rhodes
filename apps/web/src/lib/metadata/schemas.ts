export const RESERVED_METADATA_KEYS = new Set([
  "favorite",
  "archived",
  "archived_at",
  "template_draft",
  "comments",
  "template_description",
]);

export const MAX_METADATA_SCHEMAS_PER_WORKSPACE = 20;

export type MetadataFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multi_select"
  | "date"
  | "date_range"
  | "tags"
  | "number"
  | "url"
  | "checkbox";

export type MetadataDateRange = {
  start: string | null;
  end: string | null;
};

export type MetadataFieldValue =
  | string
  | number
  | boolean
  | string[]
  | MetadataDateRange
  | null;

export type MetadataSchemaField = {
  id: string;
  workspace_id: string;
  field_key: string;
  field_label: string;
  field_type: MetadataFieldType;
  options: string[] | null;
  created_at: string;
};

export const METADATA_FIELD_TYPE_LABELS: Record<MetadataFieldType, string> = {
  text: "Text",
  textarea: "Long text",
  select: "Single select",
  multi_select: "Multi select",
  date: "Date",
  date_range: "Date range",
  tags: "Tags",
  number: "Number",
  url: "URL",
  checkbox: "Checkbox",
};

export function fieldKeyFromLabel(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return base || "property";
}

export function parseSchemaOptions(options: unknown): string[] | null {
  if (!Array.isArray(options)) return null;
  const values = options.filter((item): item is string => typeof item === "string");
  return values.length > 0 ? values : null;
}

export function isReservedMetadataKey(fieldKey: string): boolean {
  return RESERVED_METADATA_KEYS.has(fieldKey);
}

export function readMetadataDateRange(
  metadata: Record<string, unknown> | null | undefined,
  fieldKey: string,
): MetadataDateRange | null {
  if (!metadata) return null;
  const value = metadata[fieldKey];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  return {
    start: typeof record.start === "string" ? record.start : null,
    end: typeof record.end === "string" ? record.end : null,
  };
}

export function readMetadataTags(
  metadata: Record<string, unknown> | null | undefined,
  fieldKey: string,
): string[] {
  if (!metadata) return [];
  const value = metadata[fieldKey];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function readMetadataFieldValue(
  metadata: Record<string, unknown> | null | undefined,
  field: MetadataSchemaField,
): MetadataFieldValue {
  if (!metadata) return null;
  const value = metadata[field.field_key];
  if (value === null || value === undefined) return null;

  switch (field.field_type) {
    case "checkbox":
      return value === true;
    case "number":
      return typeof value === "number" ? value : Number(value) || null;
    case "tags":
    case "multi_select":
      return readMetadataTags(metadata, field.field_key);
    case "date_range":
      return readMetadataDateRange(metadata, field.field_key);
    default:
      return typeof value === "string" ? value : String(value);
  }
}

export function readUserMetadataValue(
  metadata: Record<string, unknown> | null | undefined,
  fieldKey: string,
): string | null {
  if (!metadata) return null;
  const value = metadata[fieldKey];
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : String(value);
}

function isEmptyMetadataValue(value: MetadataFieldValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return false;
  if (Array.isArray(value)) return value.length === 0;
  return !value.start && !value.end;
}

export function withUserMetadataValue(
  metadata: Record<string, unknown> | null | undefined,
  fieldKey: string,
  value: MetadataFieldValue,
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) };
  if (isEmptyMetadataValue(value)) {
    delete next[fieldKey];
  } else {
    next[fieldKey] = value as string | number | boolean | string[] | MetadataDateRange;
  }

  if (Array.isArray(next._ai_filled_keys)) {
    next._ai_filled_keys = next._ai_filled_keys.filter(
      (key) => key !== fieldKey,
    );
  }

  return next;
}

export function withUserMetadataField(
  metadata: Record<string, unknown> | null | undefined,
  fieldKey: string,
  value: string | null,
): Record<string, unknown> {
  return withUserMetadataValue(metadata, fieldKey, value);
}
