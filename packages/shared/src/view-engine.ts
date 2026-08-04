/**
 * Typed View Engine config schemas for ScopeViewInstance.config.
 * Bundle ViewPreset.config should converge on these shapes over time.
 */

export const VIEW_ENGINE_BASE_TYPES = [
  "kanban",
  "calendar",
  "gantt",
  "dashboard",
  "mindmap",
  "graph",
  "wiki",
] as const;

export type ViewEngineBaseType = (typeof VIEW_ENGINE_BASE_TYPES)[number];

export type MetadataFilterOp = "eq" | "neq" | "in" | "exists";

export type MetadataFilter = {
  field: string;
  op: MetadataFilterOp;
  value?: unknown;
};

export type KanbanViewConfig = {
  groupByField: string;
  cardFields?: string[];
  sortBy?: string;
  /** User-defined subtitle; falls back to an auto "Grouped by X" string when unset. */
  subtitle?: string;
};

export type DashboardWidgetType = "stat" | "breakdown" | "trend" | "list";

export type DashboardAggregation = "count" | "sum" | "avg" | "min" | "max";

export type DashboardWidget = {
  id: string;
  type: DashboardWidgetType;
  title: string;
  field: string;
  aggregation?: DashboardAggregation;
  groupByField?: string;
  filter?: MetadataFilter;
};

export type DashboardViewConfig = {
  widgets: DashboardWidget[];
  /** User-defined subtitle shown under the page title. */
  subtitle?: string;
};

export type GanttViewConfig = {
  startField: string;
  endField?: string;
  hierarchyFields: string[];
  colorByField?: string;
  subtitle?: string;
};

export type CalendarViewConfig = {
  dateField: string;
  colorByField?: string;
  subtitle?: string;
};

export type MindMapViewConfig = {
  nodeLabelField?: string;
  colorByField?: string;
  /** Template used when the user adds a new node (document). */
  defaultTemplateSlug?: string;
  /** Relation field new canvas connections write to. */
  relationField?: string;
  subtitle?: string;
};

export type KnowledgeGraphViewConfig = {
  /** Relation field keys to traverse; omit or empty = all relation fields. */
  relationFields?: string[];
  nodeLabelField?: string;
  /** Community detection + legend (v1). Default true when omitted at render time. */
  showCommunities?: boolean;
  minDegreeHighlight?: number;
  subtitle?: string;
};

/** Wiki presets historically used `{ layout: "graph" }` — keep permissive. */
export type WikiViewConfig = {
  layout?: string;
  [key: string]: unknown;
};

export type ViewInstanceConfigByType = {
  kanban: KanbanViewConfig;
  calendar: CalendarViewConfig;
  gantt: GanttViewConfig;
  dashboard: DashboardViewConfig;
  mindmap: MindMapViewConfig;
  graph: KnowledgeGraphViewConfig;
  wiki: WikiViewConfig;
};

export type ViewInstanceConfig = ViewInstanceConfigByType[ViewEngineBaseType];

/** Persisted Mind-Map canvas positions — not used by Knowledge Graph. */
export type MindMapLayout = Record<string, { x: number; y: number }>;

export type ScopeViewInstanceRecord = {
  id: string;
  workspace_id: string;
  base_view_type: string;
  label: string;
  config: Record<string, unknown>;
  layout: MindMapLayout | null;
  created_from_preset_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export function isViewEngineBaseType(value: string): value is ViewEngineBaseType {
  return (VIEW_ENGINE_BASE_TYPES as readonly string[]).includes(value);
}

/** Fields compatible with a Kanban `groupByField` slot. */
export const KANBAN_GROUP_BY_FIELD_TYPES = ["select", "status"] as const;

/** Fields compatible with Calendar / Gantt date slots. */
export const DATE_VIEW_FIELD_TYPES = ["date", "date_range"] as const;

/** Fields that produce Knowledge Graph / Mind-Map edges. */
export const RELATION_VIEW_FIELD_TYPES = ["relation"] as const;

/** Aggregations that require a numeric metadata field. */
export const DASHBOARD_NUMERIC_AGGREGATIONS: readonly DashboardAggregation[] = [
  "sum",
  "avg",
  "min",
  "max",
];

/** Fields compatible with a Dashboard breakdown widget's `groupByField` slot. */
export const DASHBOARD_BREAKDOWN_GROUP_FIELD_TYPES = ["select", "status"] as const;

/** Fields compatible with a Dashboard trend widget's `groupByField` slot. */
export const DASHBOARD_TREND_GROUP_FIELD_TYPES = ["date", "date_range"] as const;

function isDashboardWidgetShape(value: unknown): value is DashboardWidget {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.trim().length > 0 &&
    typeof record.title === "string" &&
    typeof record.field === "string" &&
    record.field.trim().length > 0 &&
    ["stat", "breakdown", "trend", "list"].includes(record.type as string)
  );
}

function normalizeDashboardWidget(raw: DashboardWidget): DashboardWidget {
  const aggregation =
    typeof raw.aggregation === "string" &&
    (["count", "sum", "avg", "min", "max"] as string[]).includes(raw.aggregation)
      ? raw.aggregation
      : undefined;
  const groupByField =
    typeof raw.groupByField === "string" && raw.groupByField.trim()
      ? raw.groupByField.trim()
      : undefined;
  const filter =
    raw.filter &&
    typeof raw.filter === "object" &&
    typeof raw.filter.field === "string" &&
    typeof raw.filter.op === "string"
      ? raw.filter
      : undefined;

  return {
    id: raw.id,
    type: raw.type,
    title: raw.title,
    field: raw.field,
    ...(aggregation ? { aggregation } : {}),
    ...(groupByField ? { groupByField } : {}),
    ...(filter ? { filter } : {}),
  };
}

/** Normalize preset/instance config into DashboardViewConfig; drops malformed widgets. */
export function resolveDashboardConfig(
  config: Record<string, unknown> | null | undefined,
): DashboardViewConfig | null {
  if (!config) return null;
  const raw = Array.isArray(config.widgets) ? config.widgets : [];
  const widgets = raw
    .filter(isDashboardWidgetShape)
    .map((widget) => normalizeDashboardWidget(widget));
  const subtitle =
    typeof config.subtitle === "string" && config.subtitle.trim()
      ? config.subtitle.trim()
      : undefined;
  return {
    widgets,
    ...(subtitle ? { subtitle } : {}),
  };
}

/** Normalize preset/instance config into MindMapViewConfig. */
export function resolveMindMapConfig(
  config: Record<string, unknown> | null | undefined,
): MindMapViewConfig {
  if (!config) return {};
  const nodeLabelField =
    typeof config.nodeLabelField === "string" && config.nodeLabelField.trim()
      ? config.nodeLabelField.trim()
      : undefined;
  const colorByField =
    typeof config.colorByField === "string" && config.colorByField.trim()
      ? config.colorByField.trim()
      : undefined;
  const defaultTemplateSlug =
    typeof config.defaultTemplateSlug === "string" && config.defaultTemplateSlug.trim()
      ? config.defaultTemplateSlug.trim()
      : undefined;
  const relationField =
    typeof config.relationField === "string" && config.relationField.trim()
      ? config.relationField.trim()
      : undefined;
  const subtitle =
    typeof config.subtitle === "string" && config.subtitle.trim()
      ? config.subtitle.trim()
      : undefined;

  return {
    ...(nodeLabelField ? { nodeLabelField } : {}),
    ...(colorByField ? { colorByField } : {}),
    ...(defaultTemplateSlug ? { defaultTemplateSlug } : {}),
    ...(relationField ? { relationField } : {}),
    ...(subtitle ? { subtitle } : {}),
  };
}

/** Normalize preset/instance config into KnowledgeGraphViewConfig. */
export function resolveKnowledgeGraphConfig(
  config: Record<string, unknown> | null | undefined,
): KnowledgeGraphViewConfig {
  if (!config) return {};
  const relationFieldsRaw = Array.isArray(config.relationFields)
    ? config.relationFields.filter((value): value is string => typeof value === "string")
    : undefined;
  const nodeLabelField =
    typeof config.nodeLabelField === "string" && config.nodeLabelField.trim()
      ? config.nodeLabelField.trim()
      : undefined;
  const showCommunities =
    typeof config.showCommunities === "boolean" ? config.showCommunities : undefined;
  const minDegreeHighlight =
    typeof config.minDegreeHighlight === "number" ? config.minDegreeHighlight : undefined;
  const subtitle =
    typeof config.subtitle === "string" && config.subtitle.trim()
      ? config.subtitle.trim()
      : undefined;

  return {
    ...(relationFieldsRaw && relationFieldsRaw.length > 0
      ? { relationFields: relationFieldsRaw }
      : {}),
    ...(nodeLabelField ? { nodeLabelField } : {}),
    ...(showCommunities !== undefined ? { showCommunities } : {}),
    ...(minDegreeHighlight !== undefined ? { minDegreeHighlight } : {}),
    ...(subtitle ? { subtitle } : {}),
  };
}

/** Normalize preset/instance config into GanttViewConfig. */
export function resolveGanttConfig(
  config: Record<string, unknown> | null | undefined,
): GanttViewConfig | null {
  if (!config) return null;
  const startField =
    typeof config.startField === "string" && config.startField.trim()
      ? config.startField.trim()
      : null;
  if (!startField) return null;

  const endField =
    typeof config.endField === "string" && config.endField.trim()
      ? config.endField.trim()
      : undefined;
  const hierarchyFields = Array.isArray(config.hierarchyFields)
    ? config.hierarchyFields.filter((value): value is string => typeof value === "string")
    : [];
  const colorByField =
    typeof config.colorByField === "string" && config.colorByField.trim()
      ? config.colorByField.trim()
      : undefined;
  const subtitle =
    typeof config.subtitle === "string" && config.subtitle.trim()
      ? config.subtitle.trim()
      : undefined;

  return {
    startField,
    hierarchyFields,
    ...(endField ? { endField } : {}),
    ...(colorByField ? { colorByField } : {}),
    ...(subtitle ? { subtitle } : {}),
  };
}

/** Normalize preset/instance config into CalendarViewConfig. */
export function resolveCalendarConfig(
  config: Record<string, unknown> | null | undefined,
): CalendarViewConfig | null {
  if (!config) return null;
  const dateField =
    typeof config.dateField === "string" && config.dateField.trim()
      ? config.dateField.trim()
      : null;
  if (!dateField) return null;

  const colorByField =
    typeof config.colorByField === "string" && config.colorByField.trim()
      ? config.colorByField.trim()
      : undefined;
  const subtitle =
    typeof config.subtitle === "string" && config.subtitle.trim()
      ? config.subtitle.trim()
      : undefined;

  return {
    dateField,
    ...(colorByField ? { colorByField } : {}),
    ...(subtitle ? { subtitle } : {}),
  };
}

/**
 * Normalize preset/instance config into KanbanViewConfig.
 * Bundle seeds historically used `groupBy`; typed engine uses `groupByField`.
 */
export function resolveKanbanConfig(
  config: Record<string, unknown> | null | undefined,
): KanbanViewConfig | null {
  if (!config) return null;
  const groupByField =
    typeof config.groupByField === "string" && config.groupByField.trim()
      ? config.groupByField.trim()
      : typeof config.groupBy === "string" && config.groupBy.trim()
        ? config.groupBy.trim()
        : null;
  if (!groupByField) return null;

  const cardFields = Array.isArray(config.cardFields)
    ? config.cardFields.filter((value): value is string => typeof value === "string")
    : undefined;
  const sortBy =
    typeof config.sortBy === "string" && config.sortBy.trim()
      ? config.sortBy.trim()
      : undefined;
  const subtitle =
    typeof config.subtitle === "string" && config.subtitle.trim()
      ? config.subtitle.trim()
      : undefined;

  return {
    groupByField,
    ...(cardFields && cardFields.length > 0 ? { cardFields } : {}),
    ...(sortBy ? { sortBy } : {}),
    ...(subtitle ? { subtitle } : {}),
  };
}
