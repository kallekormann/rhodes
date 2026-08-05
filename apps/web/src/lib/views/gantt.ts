import {
  resolveGanttConfig,
  type GanttViewConfig,
  type ScopeViewInstanceRecord,
} from "@rhodes/shared/view-engine";
import { readMetadataDateRange, readUserMetadataValue, type MetadataSchemaField } from "@/lib/metadata/schemas";

export type GanttDocument = {
  id: string;
  title: string;
  metadata: Record<string, unknown> | null;
};

export type GanttTaskType = "summary" | "task";

export type GanttTask = {
  id: string;
  text: string;
  start: Date;
  end: Date;
  type: GanttTaskType;
  parent?: string;
  open?: boolean;
  progress?: number;
  color?: string;
  /** Only set for leaf tasks (backed by a real document). */
  documentId?: string;
  hasCollision?: boolean;
};

export function pickGanttInstance(
  instances: ScopeViewInstanceRecord[],
): ScopeViewInstanceRecord | null {
  return instances.find((instance) => instance.base_view_type === "gantt") ?? null;
}

export function ganttConfigFromInstance(
  instance: ScopeViewInstanceRecord | null,
): GanttViewConfig | null {
  return resolveGanttConfig(instance?.config);
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readDurationDays(
  metadata: Record<string, unknown> | null,
  durationFieldKey?: string | null,
): number | null {
  if (!metadata) return null;
  const keys = [
    ...(durationFieldKey ? [durationFieldKey] : []),
    "planned_duration_days",
  ];
  for (const key of keys) {
    const raw = metadata[key];
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim()
          ? Number(raw)
          : NaN;
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return null;
}

function addDays(start: Date, days: number): Date {
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + days);
  return end;
}

/** Reads a document's [start, end] span for the Gantt bar. Returns null if unset/unparseable. */
export function documentTaskDates(
  doc: GanttDocument,
  startField: MetadataSchemaField,
  endField: MetadataSchemaField | null,
  durationFieldKey?: string | null,
): { start: Date; end: Date } | null {
  if (startField.field_type === "date_range") {
    const range = readMetadataDateRange(doc.metadata, startField.field_key);
    const start = parseDateOnly(range?.start);
    if (!start) return null;
    const end = parseDateOnly(range?.end) ?? start;
    return { start, end };
  }

  const start = parseDateOnly(doc.metadata ? doc.metadata[startField.field_key] : null);
  if (!start) return null;

  if (endField) {
    const end = parseDateOnly(doc.metadata ? doc.metadata[endField.field_key] : null) ?? start;
    return { start, end };
  }

  const days = readDurationDays(doc.metadata, durationFieldKey);
  if (days != null) {
    return { start, end: addDays(start, days) };
  }

  return { start, end: start };
}

function hierarchyValue(doc: GanttDocument, field: MetadataSchemaField): string {
  return readUserMetadataValue(doc.metadata, field.field_key)?.trim() || "(Unassigned)";
}

/**
 * Builds a nested summary/leaf task tree: one summary row per distinct value at each
 * hierarchyFields level, leaf rows for documents. Summary bars span their descendants'
 * min start / max end.
 */
export function buildGanttTasks(
  documents: GanttDocument[],
  hierarchyFields: MetadataSchemaField[],
  startField: MetadataSchemaField,
  endField: MetadataSchemaField | null,
  durationFieldKey?: string | null,
): GanttTask[] {
  type Entry = { doc: GanttDocument; start: Date; end: Date };
  const entries: Entry[] = [];
  for (const doc of documents) {
    const span = documentTaskDates(doc, startField, endField, durationFieldKey);
    if (span) entries.push({ doc, ...span });
  }

  const tasks: GanttTask[] = [];

  function walk(level: number, parentId: string | undefined, group: Entry[]) {
    if (level >= hierarchyFields.length) {
      for (const entry of group) {
        tasks.push({
          id: entry.doc.id,
          text: entry.doc.title || "Untitled",
          start: entry.start,
          end: entry.end,
          type: "task",
          parent: parentId,
          documentId: entry.doc.id,
        });
      }
      return;
    }

    const field = hierarchyFields[level]!;
    const buckets = new Map<string, Entry[]>();
    for (const entry of group) {
      const key = hierarchyValue(entry.doc, field);
      const bucket = buckets.get(key) ?? [];
      bucket.push(entry);
      buckets.set(key, bucket);
    }

    for (const [value, bucketEntries] of buckets) {
      const summaryId = `${parentId ?? "root"}::${field.field_key}:${value}`;
      const start = new Date(Math.min(...bucketEntries.map((e) => e.start.getTime())));
      const end = new Date(Math.max(...bucketEntries.map((e) => e.end.getTime())));
      tasks.push({
        id: summaryId,
        text: value,
        start,
        end,
        type: "summary",
        parent: parentId,
        open: true,
      });
      walk(level + 1, summaryId, bucketEntries);
    }
  }

  walk(0, undefined, entries);
  return markCollisions(tasks);
}

/** Flags leaf tasks that overlap in date range with a sibling under the same parent. */
export function markCollisions(tasks: GanttTask[]): GanttTask[] {
  const bySiblingGroup = new Map<string, GanttTask[]>();
  for (const task of tasks) {
    if (task.type !== "task") continue;
    const key = task.parent ?? "__root__";
    const group = bySiblingGroup.get(key) ?? [];
    group.push(task);
    bySiblingGroup.set(key, group);
  }

  const collisions = new Set<string>();
  for (const group of bySiblingGroup.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i]!;
        const b = group[j]!;
        if (a.start < b.end && b.start < a.end) {
          collisions.add(a.id);
          collisions.add(b.id);
        }
      }
    }
  }

  return tasks.map((task) => (collisions.has(task.id) ? { ...task, hasCollision: true } : task));
}
