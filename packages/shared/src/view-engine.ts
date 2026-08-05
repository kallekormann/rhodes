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
  /** When endField is unset, add this many days from start (e.g. planned_duration_days). */
  durationField?: string;
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
  /** Include library files as nodes (default true). */
  showLibraryNodes?: boolean;
  minDegreeHighlight?: number;
  subtitle?: string;
};

/** Wiki Space tab config — hierarchy lives in Origin + layout.order. */
export type WikiViewConfig = {
  /** Space home / root document for this tab. */
  rootDocumentId?: string | null;
  /** Relation used for parent links; default "origin". */
  relationField?: string;
  /** Highlights picker default; does not skip template selection. */
  defaultTemplateSlug?: string;
  subtitle?: string;
};

/** Sibling display order under each parent (parent document id → child ids). */
export type WikiLayout = {
  v: 1;
  order: Record<string, string[]>;
};

export function isWikiLayoutV1(value: unknown): value is WikiLayout {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === 1 &&
    record.order != null &&
    typeof record.order === "object" &&
    !Array.isArray(record.order)
  );
}

export function createEmptyWikiLayout(): WikiLayout {
  return { v: 1, order: {} };
}

export function normalizeWikiLayout(value: unknown): WikiLayout {
  if (isWikiLayoutV1(value)) {
    const order: Record<string, string[]> = {};
    for (const [parentId, children] of Object.entries(value.order)) {
      if (!Array.isArray(children)) continue;
      order[parentId] = children.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      );
    }
    return { v: 1, order };
  }
  return createEmptyWikiLayout();
}

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

/** Persisted Mind-Map tree + positions — not used by Knowledge Graph. */
export type MindMapLayoutV1 = Record<string, { x: number; y: number }>;

export type MindMapSide = "left" | "right";

export type MindMapNodeLayout = {
  x: number;
  y: number;
  parentId: string | null;
  /** null = placeholder (no DB document yet) */
  documentId: string | null;
  /**
   * Branch side relative to the root. Direct root children set this explicitly;
   * deeper nodes inherit via their ancestor. Null/undefined on the root.
   */
  side?: MindMapSide | null;
};

export type MindMapLayout = {
  v: 2;
  rootId: string;
  nodes: Record<string, MindMapNodeLayout>;
};

export function isMindMapLayoutV2(value: unknown): value is MindMapLayout {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === 2 &&
    typeof record.rootId === "string" &&
    record.nodes != null &&
    typeof record.nodes === "object"
  );
}

export function createEmptyMindMapLayout(
  rootId = "local:root",
): MindMapLayout {
  return {
    v: 2,
    rootId,
    nodes: {
      [rootId]: {
        x: 420,
        y: 280,
        parentId: null,
        documentId: null,
        side: null,
      },
    },
  };
}

/** Accept v2, legacy v1 position maps, null/empty → always a usable v2 tree. */
export function normalizeMindMapLayout(raw: unknown): MindMapLayout {
  if (isMindMapLayoutV2(raw)) {
    const root = raw.nodes[raw.rootId];
    if (!root) return createEmptyMindMapLayout(raw.rootId);
    return backfillMindMapSides(raw);
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const entries = Object.entries(raw as MindMapLayoutV1).filter(
      ([, pos]) =>
        pos &&
        typeof pos === "object" &&
        typeof (pos as { x?: unknown }).x === "number" &&
        typeof (pos as { y?: unknown }).y === "number",
    );
    if (entries.length === 1) {
      // Single legacy node → that document is the root (no synthetic placeholder).
      const [docId, pos] = entries[0]!;
      return {
        v: 2,
        rootId: docId,
        nodes: {
          [docId]: {
            x: pos.x,
            y: pos.y,
            parentId: null,
            documentId: docId,
            side: null,
          },
        },
      };
    }
    if (entries.length > 1) {
      // Multiple legacy nodes → keep a placeholder root so guided setup can
      // still establish a central topic; existing docs hang underneath.
      const rootId = "local:root";
      const nodes: Record<string, MindMapNodeLayout> = {
        [rootId]: {
          x: 420,
          y: 280,
          parentId: null,
          documentId: null,
          side: null,
        },
      };
      entries.forEach(([docId, pos], index) => {
        nodes[docId] = {
          x: pos.x,
          y: pos.y,
          parentId: rootId,
          documentId: docId,
          side: index % 2 === 0 ? "right" : "left",
        };
      });
      return { v: 2, rootId, nodes };
    }
  }

  return createEmptyMindMapLayout();
}

/** Ensure every non-root node has a stable left/right branch side. */
export function backfillMindMapSides(layout: MindMapLayout): MindMapLayout {
  const root = layout.nodes[layout.rootId];
  if (!root) return layout;

  const rootChildren = Object.entries(layout.nodes)
    .filter(([, node]) => node.parentId === layout.rootId)
    .sort(([a], [b]) => a.localeCompare(b));

  let changed = false;
  const nodes: Record<string, MindMapNodeLayout> = {
    ...layout.nodes,
    [layout.rootId]: { ...root, side: null },
  };
  if (root.side != null) changed = true;

  rootChildren.forEach(([id, node], index) => {
    const side: MindMapSide =
      node.side === "left" || node.side === "right"
        ? node.side
        : node.x < root.x
          ? "left"
          : node.x > root.x
            ? "right"
            : index % 2 === 0
              ? "right"
              : "left";
    if (node.side !== side) {
      nodes[id] = { ...node, side };
      changed = true;
    }
  });

  // Descendants inherit the side of their root-branch ancestor.
  const resolveSide = (nodeId: string): MindMapSide => {
    let current: string | null | undefined = nodeId;
    while (current) {
      const node: MindMapNodeLayout | undefined = nodes[current];
      if (!node?.parentId) return "right";
      if (node.parentId === layout.rootId) {
        return node.side === "left" ? "left" : "right";
      }
      current = node.parentId;
    }
    return "right";
  };

  for (const [id, node] of Object.entries(nodes)) {
    if (id === layout.rootId || node.parentId === layout.rootId) continue;
    const side = resolveSide(id);
    if (node.side !== side) {
      nodes[id] = { ...node, side };
      changed = true;
    }
  }

  return changed ? { ...layout, nodes } : layout;
}

export type ScopeViewInstanceRecord = {
  id: string;
  workspace_id: string;
  base_view_type: string;
  label: string;
  config: Record<string, unknown>;
  /** Mind-map v2 / legacy v1, or Wiki order layout; other engines leave null. */
  layout: MindMapLayout | MindMapLayoutV1 | WikiLayout | null;
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

/** Normalize preset/instance config into WikiViewConfig. */
export function resolveWikiConfig(
  config: Record<string, unknown> | null | undefined,
): WikiViewConfig {
  if (!config) return {};
  const rootDocumentId =
    typeof config.rootDocumentId === "string" && config.rootDocumentId.trim()
      ? config.rootDocumentId.trim()
      : config.rootDocumentId === null
        ? null
        : undefined;
  const relationField =
    typeof config.relationField === "string" && config.relationField.trim()
      ? config.relationField.trim()
      : undefined;
  const defaultTemplateSlug =
    typeof config.defaultTemplateSlug === "string" &&
    config.defaultTemplateSlug.trim()
      ? config.defaultTemplateSlug.trim()
      : undefined;
  const subtitle =
    typeof config.subtitle === "string" && config.subtitle.trim()
      ? config.subtitle.trim()
      : undefined;

  return {
    ...(rootDocumentId !== undefined ? { rootDocumentId } : {}),
    ...(relationField ? { relationField } : {}),
    ...(defaultTemplateSlug ? { defaultTemplateSlug } : {}),
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
  const showLibraryNodes =
    typeof config.showLibraryNodes === "boolean" ? config.showLibraryNodes : undefined;
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
    ...(showLibraryNodes !== undefined ? { showLibraryNodes } : {}),
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
  const durationField =
    typeof config.durationField === "string" && config.durationField.trim()
      ? config.durationField.trim()
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
    ...(durationField ? { durationField } : {}),
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
