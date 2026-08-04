import {
  KANBAN_GROUP_BY_FIELD_TYPES,
  resolveKanbanConfig,
  type KanbanViewConfig,
} from "@rhodes/shared/view-engine";
import type { ScopeViewInstanceRecord } from "@rhodes/shared/view-engine";
import {
  parseSchemaOptions,
  parseStatusOptions,
  type MetadataSchemaField,
  type StatusCategory,
  type StatusOption,
} from "@/lib/metadata/schemas";

export type KanbanColumn = {
  id: string;
  label: string;
  /** null means documents with no value for the group-by field. */
  value: string | null;
  category?: StatusCategory;
};

const STATUS_CATEGORY_ORDER: StatusCategory[] = [
  "unstarted",
  "started",
  "completed",
  "canceled",
];

const UNSET_COLUMN_ID = "__unset__";

export function pickKanbanInstance(
  instances: ScopeViewInstanceRecord[],
): ScopeViewInstanceRecord | null {
  return (
    instances.find((instance) => instance.base_view_type === "kanban") ?? null
  );
}

export function resolveKanbanGroupField(
  schemas: MetadataSchemaField[],
  config: KanbanViewConfig | null,
): MetadataSchemaField | null {
  const allowed = new Set<string>(KANBAN_GROUP_BY_FIELD_TYPES);
  if (config?.groupByField) {
    const matched = schemas.find(
      (schema) =>
        schema.field_key === config.groupByField && allowed.has(schema.field_type),
    );
    if (matched) return matched;
  }

  return (
    schemas.find((schema) => schema.field_type === "status") ??
    schemas.find((schema) => schema.field_type === "select") ??
    null
  );
}

export function buildKanbanColumns(field: MetadataSchemaField): KanbanColumn[] {
  if (field.field_type === "status") {
    const options = parseStatusOptions(field.options) ?? [];
    const sorted = [...options].sort((a, b) => {
      const catDiff =
        STATUS_CATEGORY_ORDER.indexOf(a.category) -
        STATUS_CATEGORY_ORDER.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      return a.label.localeCompare(b.label);
    });
    return [
      ...sorted.map((option: StatusOption) => ({
        id: option.value,
        label: option.label,
        value: option.value,
        category: option.category,
      })),
      {
        id: UNSET_COLUMN_ID,
        label: "No status",
        value: null,
      },
    ];
  }

  const options = parseSchemaOptions(field.options) ?? [];
  return [
    ...options.map((value) => ({
      id: value,
      label: value.replace(/_/g, " "),
      value,
    })),
    {
      id: UNSET_COLUMN_ID,
      label: "Unset",
      value: null,
    },
  ];
}

export function kanbanConfigFromInstance(
  instance: ScopeViewInstanceRecord | null,
): KanbanViewConfig | null {
  if (!instance) return null;
  return resolveKanbanConfig(instance.config);
}

export { UNSET_COLUMN_ID };
