export const RESERVED_METADATA_KEYS = new Set([
  "favorite",
  "archived",
  "archived_at",
  "template_draft",
  "comments",
  "template_description",
]);

export const MAX_METADATA_SCHEMAS_PER_WORKSPACE = 20;
export const MAX_GROUP_INSTANCES_PER_DOCUMENT = 10;

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
  options: string[] | unknown | null;
  group_id?: string | null;
  sub_key?: string | null;
  sort_order?: number;
  ai_fill_enabled?: boolean;
  created_at: string;
};

export type MetadataGroupField = {
  id: string;
  group_id: string;
  sub_key: string;
  field_label: string;
  field_type: MetadataFieldType;
  options: string[] | unknown | null;
  sort_order: number;
  ai_fill_enabled?: boolean;
};

export type MetadataSchemaGroup = {
  id: string;
  workspace_id: string;
  group_key: string;
  group_label: string;
  repeatable: boolean;
  sort_order: number;
  created_at: string;
  fields: MetadataGroupField[];
};

export type GroupInstance = Record<string, MetadataFieldValue>;

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

export function parseSchemaUnit(options: unknown): string | null {
  if (!options || typeof options !== "object" || Array.isArray(options)) return null;
  const unit = (options as Record<string, unknown>).unit;
  return typeof unit === "string" && unit.trim() ? unit.trim() : null;
}

export function schemaOptionsWithUnit(
  optionValues: string[] | undefined,
  unit: string | undefined,
): string[] | { unit: string } | null {
  if (optionValues && optionValues.length > 0) return optionValues;
  if (unit?.trim()) return { unit: unit.trim() };
  return null;
}

export function subKeyFromLabel(label: string): string {
  return fieldKeyFromLabel(label).slice(0, 32);
}

export function groupFieldKey(groupKey: string, subKey: string): string {
  return `${groupKey}_${subKey}`;
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
  field: Pick<MetadataSchemaField, "field_key" | "field_type">,
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

function normalizeGroupInstance(raw: unknown): GroupInstance {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as GroupInstance;
}

function isEmptyGroupInstance(instance: GroupInstance): boolean {
  return Object.values(instance).every((value) => isEmptyMetadataValue(value));
}

function cleanGroupInstance(instance: GroupInstance): GroupInstance {
  const next: GroupInstance = {};
  for (const [key, value] of Object.entries(instance)) {
    if (!isEmptyMetadataValue(value)) {
      next[key] = value;
    }
  }
  return next;
}

export function readGroupInstances(
  metadata: Record<string, unknown> | null | undefined,
  groupKey: string,
): GroupInstance[] {
  if (!metadata) return [{}];
  const raw = metadata[groupKey];
  if (!Array.isArray(raw) || raw.length === 0) return [{}];
  return raw.map(normalizeGroupInstance);
}

export function readGroupFieldValue(
  instance: GroupInstance,
  field: Pick<MetadataGroupField, "sub_key" | "field_type">,
): MetadataFieldValue {
  return readMetadataFieldValue(instance as Record<string, unknown>, {
    field_key: field.sub_key,
    field_type: field.field_type,
  });
}

export function withGroupInstances(
  metadata: Record<string, unknown> | null | undefined,
  groupKey: string,
  instances: GroupInstance[],
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) };
  const cleaned = instances
    .map(cleanGroupInstance)
    .filter((instance) => !isEmptyGroupInstance(instance));

  if (cleaned.length === 0) {
    delete next[groupKey];
  } else {
    next[groupKey] = cleaned;
  }

  return next;
}

export function withGroupInstanceField(
  metadata: Record<string, unknown> | null | undefined,
  groupKey: string,
  instanceIndex: number,
  subKey: string,
  value: MetadataFieldValue,
): Record<string, unknown> {
  const instances = readGroupInstances(metadata, groupKey);
  while (instances.length <= instanceIndex) {
    instances.push({});
  }

  const instance = { ...instances[instanceIndex] };
  if (isEmptyMetadataValue(value)) {
    delete instance[subKey];
  } else {
    instance[subKey] = value;
  }
  instances[instanceIndex] = instance;

  return withGroupInstances(metadata, groupKey, instances);
}

export function addGroupInstance(
  metadata: Record<string, unknown> | null | undefined,
  groupKey: string,
): Record<string, unknown> {
  const instances = readGroupInstances(metadata, groupKey);
  if (instances.length >= MAX_GROUP_INSTANCES_PER_DOCUMENT) {
    return metadata ?? {};
  }
  return withGroupInstances(metadata, groupKey, [...instances, {}]);
}

export function removeGroupInstance(
  metadata: Record<string, unknown> | null | undefined,
  groupKey: string,
  instanceIndex: number,
): Record<string, unknown> {
  const instances = readGroupInstances(metadata, groupKey);
  const next = instances.filter((_, index) => index !== instanceIndex);
  return withGroupInstances(metadata, groupKey, next.length > 0 ? next : [{}]);
}

export function groupFieldAsSchemaField(
  group: MetadataSchemaGroup,
  field: MetadataGroupField,
): MetadataSchemaField {
  return {
    id: field.id,
    workspace_id: group.workspace_id,
    field_key: field.sub_key,
    field_label: field.field_label,
    field_type: field.field_type,
    options: field.options,
    group_id: group.id,
    sub_key: field.sub_key,
    sort_order: field.sort_order,
    ai_fill_enabled: field.ai_fill_enabled ?? false,
    created_at: group.created_at,
  };
}
