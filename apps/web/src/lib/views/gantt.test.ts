import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  buildGanttTasks,
  documentTaskDates,
  type GanttDocument,
} from "@/lib/views/gantt";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";

const startField: MetadataSchemaField = {
  id: "1",
  workspace_id: "ws",
  field_key: "start_date",
  field_label: "Start",
  field_type: "date",
  options: null,
  created_at: "",
};

const endField: MetadataSchemaField = {
  id: "2",
  workspace_id: "ws",
  field_key: "due_date",
  field_label: "Due",
  field_type: "date",
  options: null,
  created_at: "",
};

const rangeField: MetadataSchemaField = {
  id: "3",
  workspace_id: "ws",
  field_key: "sprint",
  field_label: "Sprint",
  field_type: "date_range",
  options: null,
  created_at: "",
};

const projectField: MetadataSchemaField = {
  id: "4",
  workspace_id: "ws",
  field_key: "project",
  field_label: "Project",
  field_type: "select",
  options: null,
  created_at: "",
};

describe("documentTaskDates", () => {
  it("uses start+end fields when both are plain dates", () => {
    const doc: GanttDocument = {
      id: "a",
      title: "A",
      metadata: { start_date: "2026-08-01", due_date: "2026-08-05" },
    };
    const span = documentTaskDates(doc, startField, endField);
    expect(span && format(span.start, "yyyy-MM-dd")).toBe("2026-08-01");
    expect(span && format(span.end, "yyyy-MM-dd")).toBe("2026-08-05");
  });

  it("falls back to a zero-duration span when no end field is configured", () => {
    const doc: GanttDocument = { id: "a", title: "A", metadata: { start_date: "2026-08-01" } };
    const span = documentTaskDates(doc, startField, null);
    expect(span && format(span.start, "yyyy-MM-dd")).toBe("2026-08-01");
    expect(span && format(span.end, "yyyy-MM-dd")).toBe("2026-08-01");
  });

  it("reads a date_range field directly", () => {
    const doc: GanttDocument = {
      id: "a",
      title: "A",
      metadata: { sprint: { start: "2026-08-01", end: "2026-08-10" } },
    };
    const span = documentTaskDates(doc, rangeField, null);
    expect(span && format(span.start, "yyyy-MM-dd")).toBe("2026-08-01");
    expect(span && format(span.end, "yyyy-MM-dd")).toBe("2026-08-10");
  });

  it("returns null when the start value is missing", () => {
    const doc: GanttDocument = { id: "a", title: "A", metadata: {} };
    expect(documentTaskDates(doc, startField, endField)).toBeNull();
  });
});

describe("buildGanttTasks", () => {
  it("groups documents into summary rows per hierarchy field value", () => {
    const docs: GanttDocument[] = [
      { id: "a", title: "A", metadata: { project: "Alpha", start_date: "2026-08-01", due_date: "2026-08-03" } },
      { id: "b", title: "B", metadata: { project: "Alpha", start_date: "2026-08-04", due_date: "2026-08-06" } },
      { id: "c", title: "C", metadata: { project: "Beta", start_date: "2026-08-01", due_date: "2026-08-02" } },
    ];
    const tasks = buildGanttTasks(docs, [projectField], startField, endField);
    const summaries = tasks.filter((t) => t.type === "summary");
    const leaves = tasks.filter((t) => t.type === "task");

    expect(summaries.map((s) => s.text).sort()).toEqual(["Alpha", "Beta"]);
    expect(leaves).toHaveLength(3);

    const alpha = summaries.find((s) => s.text === "Alpha")!;
    expect(format(alpha.start, "yyyy-MM-dd")).toBe("2026-08-01");
    expect(format(alpha.end, "yyyy-MM-dd")).toBe("2026-08-06");
    expect(leaves.filter((l) => l.parent === alpha.id)).toHaveLength(2);
  });

  it("flags overlapping siblings as collisions", () => {
    const docs: GanttDocument[] = [
      { id: "a", title: "A", metadata: { project: "Alpha", start_date: "2026-08-01", due_date: "2026-08-05" } },
      { id: "b", title: "B", metadata: { project: "Alpha", start_date: "2026-08-03", due_date: "2026-08-07" } },
      { id: "c", title: "C", metadata: { project: "Alpha", start_date: "2026-08-10", due_date: "2026-08-12" } },
    ];
    const tasks = buildGanttTasks(docs, [projectField], startField, endField);
    const leaves = tasks.filter((t) => t.type === "task");
    expect(leaves.find((l) => l.documentId === "a")?.hasCollision).toBe(true);
    expect(leaves.find((l) => l.documentId === "b")?.hasCollision).toBe(true);
    expect(leaves.find((l) => l.documentId === "c")?.hasCollision).toBeFalsy();
  });

  it("builds flat leaf tasks when no hierarchy fields are configured", () => {
    const docs: GanttDocument[] = [
      { id: "a", title: "A", metadata: { start_date: "2026-08-01", due_date: "2026-08-02" } },
    ];
    const tasks = buildGanttTasks(docs, [], startField, endField);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.type).toBe("task");
    expect(tasks[0]?.parent).toBeUndefined();
  });
});
