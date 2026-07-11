export const RESERVED_METADATA_KEYS = new Set([
  "favorite",
  "archived",
  "archived_at",
  "template_draft",
  "comments",
  "template_description",
]);

export type MetadataFieldType =
  | "text"
  | "select"
  | "date"
  | "tags"
  | "number";

export type MetadataSchemaField = {
  id: string;
  workspace_id: string;
  field_key: string;
  field_label: string;
  field_type: MetadataFieldType;
  options: string[] | null;
  created_at: string;
};

export function parseSchemaOptions(options: unknown): string[] | null {
  if (!Array.isArray(options)) return null;
  const values = options.filter((item): item is string => typeof item === "string");
  return values.length > 0 ? values : null;
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

export function withUserMetadataField(
  metadata: Record<string, unknown> | null | undefined,
  fieldKey: string,
  value: string | null,
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) };
  if (!value || value.trim().length === 0) {
    delete next[fieldKey];
  } else {
    next[fieldKey] = value;
  }
  return next;
}
