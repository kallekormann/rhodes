import { describe, expect, it } from "vitest";
import { resolveKanbanConfig } from "@rhodes/shared/view-engine";
import {
  buildKanbanColumns,
  resolveKanbanGroupField,
} from "@/lib/views/kanban";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";

describe("kanban helpers", () => {
  it("normalizes legacy groupBy into groupByField", () => {
    expect(resolveKanbanConfig({ groupBy: "experiment_status" })).toEqual({
      groupByField: "experiment_status",
    });
    expect(resolveKanbanConfig({ groupByField: "feature_status" })).toEqual({
      groupByField: "feature_status",
    });
    expect(resolveKanbanConfig({})).toBeNull();
  });

  it("builds status columns by category then adds unset", () => {
    const field: MetadataSchemaField = {
      id: "1",
      workspace_id: "ws",
      field_key: "feature_status",
      field_label: "Feature status",
      field_type: "status",
      options: [
        { value: "done", label: "Done", category: "completed" },
        { value: "todo", label: "To do", category: "unstarted" },
        { value: "doing", label: "Doing", category: "started" },
      ],
      created_at: "",
    };

    const columns = buildKanbanColumns(field);
    expect(columns.map((column) => column.id)).toEqual([
      "todo",
      "doing",
      "done",
      "__unset__",
    ]);
  });

  it("prefers configured group field when present", () => {
    const schemas: MetadataSchemaField[] = [
      {
        id: "1",
        workspace_id: "ws",
        field_key: "status",
        field_label: "Status",
        field_type: "select",
        options: ["a"],
        created_at: "",
      },
      {
        id: "2",
        workspace_id: "ws",
        field_key: "experiment_status",
        field_label: "Experiment status",
        field_type: "status",
        options: [{ value: "live", label: "Live", category: "started" }],
        created_at: "",
      },
    ];

    const field = resolveKanbanGroupField(schemas, {
      groupByField: "experiment_status",
    });
    expect(field?.field_key).toBe("experiment_status");
  });
});
