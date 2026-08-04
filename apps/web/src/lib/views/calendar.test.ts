import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import { resolveCalendarConfig } from "@rhodes/shared/view-engine";
import {
  bucketDocumentsByDay,
  buildAgendaSections,
  buildMonthGrid,
  documentDateSpan,
  isDayKeyInRange,
  resolveCalendarDateField,
  type CalendarDocument,
} from "@/lib/views/calendar";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";

const dateField: MetadataSchemaField = {
  id: "1",
  workspace_id: "ws",
  field_key: "publish_date",
  field_label: "Publish date",
  field_type: "date",
  options: null,
  created_at: "",
};

const rangeField: MetadataSchemaField = {
  id: "2",
  workspace_id: "ws",
  field_key: "sprint",
  field_label: "Sprint",
  field_type: "date_range",
  options: null,
  created_at: "",
};

describe("resolveCalendarConfig", () => {
  it("requires a dateField", () => {
    expect(resolveCalendarConfig({})).toBeNull();
    expect(resolveCalendarConfig({ dateField: "publish_date" })).toEqual({
      dateField: "publish_date",
    });
  });
});

describe("resolveCalendarDateField", () => {
  it("prefers the configured field, falls back to the first compatible schema field", () => {
    const schemas = [dateField, rangeField];
    expect(resolveCalendarDateField(schemas, { dateField: "sprint" })?.field_key).toBe(
      "sprint",
    );
    expect(resolveCalendarDateField(schemas, null)?.field_key).toBe("publish_date");
    expect(resolveCalendarDateField([], null)).toBeNull();
  });
});

describe("documentDateSpan", () => {
  it("reads a plain date field as a single-day span", () => {
    const doc: CalendarDocument = { id: "a", title: "A", metadata: { publish_date: "2026-08-04" } };
    const span = documentDateSpan(doc, dateField);
    expect(span && format(span.start, "yyyy-MM-dd")).toBe("2026-08-04");
    expect(span && format(span.end, "yyyy-MM-dd")).toBe("2026-08-04");
  });

  it("reads a date_range field", () => {
    const doc: CalendarDocument = {
      id: "b",
      title: "B",
      metadata: { sprint: { start: "2026-08-01", end: "2026-08-03" } },
    };
    const span = documentDateSpan(doc, rangeField);
    expect(span && format(span.start, "yyyy-MM-dd")).toBe("2026-08-01");
    expect(span && format(span.end, "yyyy-MM-dd")).toBe("2026-08-03");
  });

  it("returns null for unset values", () => {
    const doc: CalendarDocument = { id: "c", title: "C", metadata: {} };
    expect(documentDateSpan(doc, dateField)).toBeNull();
  });
});

describe("buildMonthGrid", () => {
  it("builds full weeks covering the month", () => {
    const cells = buildMonthGrid(new Date("2026-08-15T00:00:00"));
    expect(cells.length % 7).toBe(0);
    expect(cells.some((cell) => cell.key === "2026-08-01")).toBe(true);
    expect(cells.some((cell) => cell.key === "2026-08-31")).toBe(true);
  });
});

describe("bucketDocumentsByDay", () => {
  it("assigns a single-day document to one bucket", () => {
    const docs: CalendarDocument[] = [
      { id: "a", title: "A", metadata: { publish_date: "2026-08-04" } },
    ];
    const buckets = bucketDocumentsByDay(docs, dateField);
    expect(buckets.get("2026-08-04")?.map((d) => d.id)).toEqual(["a"]);
    expect(buckets.size).toBe(1);
  });

  it("assigns a ranged document to every day in the span", () => {
    const docs: CalendarDocument[] = [
      { id: "b", title: "B", metadata: { sprint: { start: "2026-08-01", end: "2026-08-03" } } },
    ];
    const buckets = bucketDocumentsByDay(docs, rangeField);
    expect([...buckets.keys()].sort()).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });
});

describe("buildAgendaSections", () => {
  it("starts at today and lists upcoming days with docs when no range", () => {
    const buckets = new Map<string, CalendarDocument[]>([
      ["2026-08-04", [{ id: "today", title: "Today", metadata: null }]],
      ["2026-08-06", [{ id: "later", title: "Later", metadata: null }]],
      ["2026-08-01", [{ id: "past", title: "Past", metadata: null }]],
    ]);
    const sections = buildAgendaSections({
      buckets,
      today: new Date("2026-08-04T12:00:00"),
    });
    expect(sections.map((s) => s.key)).toEqual(["2026-08-04", "2026-08-06"]);
    expect(sections[0]?.isToday).toBe(true);
    expect(sections[0]?.docs.map((d) => d.id)).toEqual(["today"]);
  });

  it("emits every day in a complete range including empty endpoints", () => {
    const buckets = new Map<string, CalendarDocument[]>([
      ["2026-08-02", [{ id: "mid", title: "Mid", metadata: null }]],
    ]);
    const sections = buildAgendaSections({
      buckets,
      today: new Date("2026-08-04T12:00:00"),
      range: {
        start: new Date("2026-08-01T00:00:00"),
        end: new Date("2026-08-03T00:00:00"),
      },
    });
    expect(sections.map((s) => s.key)).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ]);
    expect(sections[0]?.docs).toEqual([]);
    expect(sections[1]?.docs.map((d) => d.id)).toEqual(["mid"]);
    expect(sections[2]?.docs).toEqual([]);
  });
});

describe("isDayKeyInRange", () => {
  it("includes endpoints inclusively", () => {
    const range = {
      start: new Date("2026-08-01T00:00:00"),
      end: new Date("2026-08-03T00:00:00"),
    };
    expect(isDayKeyInRange("2026-08-01", range)).toBe(true);
    expect(isDayKeyInRange("2026-08-02", range)).toBe(true);
    expect(isDayKeyInRange("2026-08-03", range)).toBe(true);
    expect(isDayKeyInRange("2026-08-04", range)).toBe(false);
  });
});
