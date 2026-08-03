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
};

export type GanttViewConfig = {
  startField: string;
  endField?: string;
  hierarchyFields: string[];
  colorByField?: string;
};

export type CalendarViewConfig = {
  dateField: string;
  colorByField?: string;
};

export type MindMapViewConfig = {
  nodeLabelField?: string;
  colorByField?: string;
  /** Template used when the user adds a new node (document). */
  defaultTemplateSlug?: string;
};

export type KnowledgeGraphViewConfig = {
  /** Relation field keys to traverse; omit or empty = all relation fields. */
  relationFields?: string[];
  nodeLabelField?: string;
  /** Community detection + legend (v1). Default true when omitted at render time. */
  showCommunities?: boolean;
  minDegreeHighlight?: number;
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
