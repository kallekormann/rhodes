import {
  DASHBOARD_BREAKDOWN_GROUP_FIELD_TYPES,
  DASHBOARD_NUMERIC_AGGREGATIONS,
  DASHBOARD_TREND_GROUP_FIELD_TYPES,
  resolveDashboardConfig,
  type DashboardAggregation,
  type DashboardViewConfig,
  type DashboardWidget,
  type MetadataFilter,
  type ScopeViewInstanceRecord,
} from "@rhodes/shared/view-engine";
import type { MetadataFieldType, MetadataSchemaField } from "@/lib/metadata/schemas";

export type DashboardDocument = {
  id: string;
  title: string;
  metadata: Record<string, unknown> | null;
};

export type DashboardWidgetResult =
  | { id: string; type: "stat"; title: string; value: number }
  | {
      id: string;
      type: "breakdown";
      title: string;
      groups: { label: string; value: number }[];
    }
  | {
      id: string;
      type: "trend";
      title: string;
      points: { label: string; value: number }[];
    }
  | {
      id: string;
      type: "list";
      title: string;
      items: { id: string; title: string; value: string }[];
    }
  | { id: string; type: "error"; title: string; error: string };

export function pickDashboardInstance(
  instances: ScopeViewInstanceRecord[],
): ScopeViewInstanceRecord | null {
  return (
    instances.find((instance) => instance.base_view_type === "dashboard") ?? null
  );
}

export function dashboardConfigFromInstance(
  instance: ScopeViewInstanceRecord | null,
): DashboardViewConfig | null {
  if (!instance) return null;
  return resolveDashboardConfig(instance.config) ?? { widgets: [] };
}

/** Metadata field types a widget's primary `field` slot may bind to. */
export function compatibleValueFieldTypes(
  widget: Pick<DashboardWidget, "type" | "aggregation">,
): MetadataFieldType[] | "any" {
  if (widget.aggregation && isNumericAggregation(widget.aggregation)) {
    return ["number"];
  }
  return "any";
}

/** Metadata field types a widget's `groupByField` slot may bind to. */
export function compatibleGroupFieldTypes(
  widgetType: DashboardWidget["type"],
): readonly MetadataFieldType[] {
  if (widgetType === "trend") return DASHBOARD_TREND_GROUP_FIELD_TYPES;
  return DASHBOARD_BREAKDOWN_GROUP_FIELD_TYPES;
}

export function isNumericAggregation(
  aggregation: DashboardAggregation,
): boolean {
  return (DASHBOARD_NUMERIC_AGGREGATIONS as readonly string[]).includes(
    aggregation,
  );
}

export function resolveDashboardField(
  schemas: MetadataSchemaField[],
  fieldKey: string | undefined,
): MetadataSchemaField | null {
  if (!fieldKey) return null;
  return schemas.find((schema) => schema.field_key === fieldKey) ?? null;
}

function rawFieldValue(
  metadata: Record<string, unknown> | null,
  fieldKey: string,
): unknown {
  return metadata ? metadata[fieldKey] : undefined;
}

function valueEquals(raw: unknown, expected: unknown): boolean {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if ("document_id" in record) return record.document_id === expected;
  }
  return String(raw ?? "") === String(expected ?? "");
}

function documentMatchesFilter(
  metadata: Record<string, unknown> | null,
  filter: MetadataFilter | undefined,
): boolean {
  if (!filter) return true;
  const raw = rawFieldValue(metadata, filter.field);

  switch (filter.op) {
    case "exists":
      return raw !== null && raw !== undefined && raw !== "";
    case "eq":
      return valueEquals(raw, filter.value);
    case "neq":
      return !valueEquals(raw, filter.value);
    case "in":
      return Array.isArray(filter.value) && filter.value.some((v) => valueEquals(raw, v));
    default:
      return true;
  }
}

function numericValue(
  metadata: Record<string, unknown> | null,
  fieldKey: string,
): number | null {
  const raw = rawFieldValue(metadata, fieldKey);
  if (raw === null || raw === undefined || raw === "") return null;
  const num = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(num) ? num : null;
}

function aggregateDocuments(
  docs: DashboardDocument[],
  fieldKey: string,
  aggregation: DashboardAggregation,
): number {
  if (aggregation === "count") return docs.length;

  const numbers = docs
    .map((doc) => numericValue(doc.metadata, fieldKey))
    .filter((value): value is number => value !== null);

  if (numbers.length === 0) return 0;

  switch (aggregation) {
    case "sum":
      return numbers.reduce((sum, value) => sum + value, 0);
    case "avg":
      return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    case "min":
      return Math.min(...numbers);
    case "max":
      return Math.max(...numbers);
    default:
      return docs.length;
  }
}

function groupLabel(
  metadata: Record<string, unknown> | null,
  fieldKey: string,
): string {
  const raw = rawFieldValue(metadata, fieldKey);
  if (raw === null || raw === undefined || raw === "") return "Unset";
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (typeof record.title === "string" && record.title) return record.title;
  }
  if (Array.isArray(raw)) return raw.length > 0 ? raw.join(", ") : "Unset";
  return String(raw);
}

/** Buckets a date/date_range value to a month-level label (yyyy-mm) for trend charts. */
function trendBucketLabel(
  metadata: Record<string, unknown> | null,
  fieldKey: string,
): string | null {
  const raw = rawFieldValue(metadata, fieldKey);
  if (raw === null || raw === undefined || raw === "") return null;

  let dateStr: string | null = null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    dateStr = typeof record.start === "string" ? record.start : null;
  } else if (typeof raw === "string") {
    dateStr = raw;
  }

  if (!dateStr || dateStr.length < 7) return null;
  return dateStr.slice(0, 7);
}

function displayValue(
  metadata: Record<string, unknown> | null,
  fieldKey: string,
): string {
  const raw = rawFieldValue(metadata, fieldKey);
  if (raw === null || raw === undefined || raw === "") return "—";
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (typeof record.title === "string") return record.title;
    if (typeof record.start === "string" || typeof record.end === "string") {
      return `${record.start ?? "…"} – ${record.end ?? "…"}`;
    }
  }
  if (Array.isArray(raw)) return raw.join(", ") || "—";
  return String(raw);
}

export function computeWidgetResult(
  widget: DashboardWidget,
  documents: DashboardDocument[],
): DashboardWidgetResult {
  const aggregation: DashboardAggregation = widget.aggregation ?? "count";
  const filtered = documents.filter((doc) =>
    documentMatchesFilter(doc.metadata, widget.filter),
  );

  switch (widget.type) {
    case "stat": {
      const value = aggregateDocuments(filtered, widget.field, aggregation);
      return { id: widget.id, type: "stat", title: widget.title, value };
    }

    case "breakdown": {
      const groupField = widget.groupByField ?? widget.field;
      const buckets = new Map<string, DashboardDocument[]>();
      for (const doc of filtered) {
        const label = groupLabel(doc.metadata, groupField);
        const bucket = buckets.get(label) ?? [];
        bucket.push(doc);
        buckets.set(label, bucket);
      }
      const groups = [...buckets.entries()]
        .map(([label, docs]) => ({
          label,
          value: aggregateDocuments(docs, widget.field, aggregation),
        }))
        .sort((a, b) => b.value - a.value);
      return { id: widget.id, type: "breakdown", title: widget.title, groups };
    }

    case "trend": {
      const dateField = widget.groupByField ?? widget.field;
      const buckets = new Map<string, DashboardDocument[]>();
      for (const doc of filtered) {
        const label = trendBucketLabel(doc.metadata, dateField);
        if (label === null) continue;
        const bucket = buckets.get(label) ?? [];
        bucket.push(doc);
        buckets.set(label, bucket);
      }
      const points = [...buckets.entries()]
        .map(([label, docs]) => ({
          label,
          value: aggregateDocuments(docs, widget.field, aggregation),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      return { id: widget.id, type: "trend", title: widget.title, points };
    }

    case "list": {
      const items = filtered.slice(0, 20).map((doc) => ({
        id: doc.id,
        title: doc.title || "Untitled",
        value: displayValue(doc.metadata, widget.field),
      }));
      return { id: widget.id, type: "list", title: widget.title, items };
    }

    default:
      return {
        id: widget.id,
        type: "error",
        title: widget.title,
        error: "Unsupported widget type",
      };
  }
}

export function computeAllWidgetResults(
  widgets: DashboardWidget[],
  documents: DashboardDocument[],
): DashboardWidgetResult[] {
  return widgets.map((widget) => computeWidgetResult(widget, documents));
}

export function createEmptyWidget(
  type: DashboardWidget["type"],
): DashboardWidget {
  return {
    id: crypto.randomUUID(),
    type,
    title: type === "stat" ? "New stat" : `New ${type}`,
    field: "",
  };
}
