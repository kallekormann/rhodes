import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  DATE_VIEW_FIELD_TYPES,
  resolveCalendarConfig,
  type CalendarViewConfig,
  type ScopeViewInstanceRecord,
} from "@rhodes/shared/view-engine";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";

/** Cap how many days a date_range document spans across cells — avoids pathological ranges. */
const MAX_RANGE_SPAN_DAYS = 62;

/** Cap agenda list length when a custom range is set. */
const MAX_AGENDA_RANGE_DAYS = 62;

export type CalendarDocument = {
  id: string;
  title: string;
  metadata: Record<string, unknown> | null;
};

export type CalendarCell = {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
};

export type CalendarAgendaSection<T extends CalendarDocument = CalendarDocument> = {
  key: string;
  date: Date;
  label: string;
  isToday: boolean;
  docs: T[];
};

export type CalendarDateRange = {
  start: Date;
  end: Date;
};

export function pickCalendarInstance(
  instances: ScopeViewInstanceRecord[],
): ScopeViewInstanceRecord | null {
  return (
    instances.find((instance) => instance.base_view_type === "calendar") ?? null
  );
}

export function calendarConfigFromInstance(
  instance: ScopeViewInstanceRecord | null,
): CalendarViewConfig | null {
  if (!instance) return null;
  return resolveCalendarConfig(instance.config);
}

export function resolveCalendarDateField(
  schemas: MetadataSchemaField[],
  config: CalendarViewConfig | null,
): MetadataSchemaField | null {
  const allowed = new Set<string>(DATE_VIEW_FIELD_TYPES);
  if (config?.dateField) {
    const matched = schemas.find(
      (schema) => schema.field_key === config.dateField && allowed.has(schema.field_type),
    );
    if (matched) return matched;
  }
  return schemas.find((schema) => allowed.has(schema.field_type)) ?? null;
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Reads a document's date span for the given field; null if unset/unparseable. */
export function documentDateSpan(
  doc: CalendarDocument,
  field: MetadataSchemaField,
): { start: Date; end: Date } | null {
  const raw = doc.metadata ? doc.metadata[field.field_key] : undefined;
  if (raw === null || raw === undefined) return null;

  if (field.field_type === "date_range" && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    const start = parseDateOnly(record.start);
    const end = parseDateOnly(record.end) ?? start;
    if (!start) return null;
    return { start, end: end ?? start };
  }

  const single = parseDateOnly(raw);
  return single ? { start: single, end: single } : null;
}

export function buildMonthGrid(monthAnchor: Date): CalendarCell[] {
  const start = startOfWeek(startOfMonth(monthAnchor));
  const end = endOfWeek(endOfMonth(monthAnchor));
  const cells: CalendarCell[] = [];

  let cursor = start;
  while (cursor <= end) {
    cells.push({
      date: cursor,
      key: format(cursor, "yyyy-MM-dd"),
      inMonth: isSameMonth(cursor, monthAnchor),
      isToday: isToday(cursor),
    });
    cursor = addDays(cursor, 1);
  }

  return cells;
}

/** Buckets documents by day (yyyy-MM-dd) for the given date/date_range field. */
export function bucketDocumentsByDay<T extends CalendarDocument>(
  documents: T[],
  field: MetadataSchemaField,
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();

  const addTo = (key: string, doc: T) => {
    const bucket = buckets.get(key) ?? [];
    bucket.push(doc);
    buckets.set(key, bucket);
  };

  for (const doc of documents) {
    const span = documentDateSpan(doc, field);
    if (!span) continue;

    const spanDays = Math.min(
      Math.max(differenceInCalendarDays(span.end, span.start), 0),
      MAX_RANGE_SPAN_DAYS,
    );

    for (let offset = 0; offset <= spanDays; offset += 1) {
      addTo(format(addDays(span.start, offset), "yyyy-MM-dd"), doc);
    }
  }

  return buckets;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeRange(range: CalendarDateRange): CalendarDateRange {
  const start = startOfLocalDay(range.start);
  const end = startOfLocalDay(range.end);
  return start.getTime() <= end.getTime()
    ? { start, end }
    : { start: end, end: start };
}

/** True when dayKey (yyyy-MM-dd) falls inside an inclusive date range. */
export function isDayKeyInRange(dayKey: string, range: CalendarDateRange): boolean {
  const { start, end } = normalizeRange(range);
  const startKey = format(start, "yyyy-MM-dd");
  const endKey = format(end, "yyyy-MM-dd");
  return dayKey >= startKey && dayKey <= endKey;
}

/**
 * Agenda sections for List mode.
 * - No range: Today (always), then each future day that has documents.
 * - With range: every day from start…end inclusive (endpoints always appear).
 */
export function buildAgendaSections<T extends CalendarDocument>(input: {
  buckets: Map<string, T[]>;
  today?: Date;
  range?: CalendarDateRange | null;
}): CalendarAgendaSection<T>[] {
  const today = startOfLocalDay(input.today ?? new Date());
  const todayKey = format(today, "yyyy-MM-dd");

  if (input.range?.start && input.range?.end) {
    const { start, end } = normalizeRange(input.range);
    const spanDays = Math.min(
      Math.max(differenceInCalendarDays(end, start), 0),
      MAX_AGENDA_RANGE_DAYS,
    );
    const sections: CalendarAgendaSection<T>[] = [];
    for (let offset = 0; offset <= spanDays; offset += 1) {
      const date = addDays(start, offset);
      const key = format(date, "yyyy-MM-dd");
      sections.push({
        key,
        date,
        label: format(date, "EEEE, MMM d"),
        isToday: key === todayKey,
        docs: input.buckets.get(key) ?? [],
      });
    }
    return sections;
  }

  const sections: CalendarAgendaSection<T>[] = [
    {
      key: todayKey,
      date: today,
      label: `Today · ${format(today, "EEEE, MMM d")}`,
      isToday: true,
      docs: input.buckets.get(todayKey) ?? [],
    },
  ];

  const upcomingKeys = [...input.buckets.keys()]
    .filter((key) => key > todayKey)
    .sort();

  for (const key of upcomingKeys) {
    const date = new Date(`${key}T00:00:00`);
    sections.push({
      key,
      date,
      label: format(date, "EEEE, MMM d"),
      isToday: false,
      docs: input.buckets.get(key) ?? [],
    });
  }

  return sections;
}
