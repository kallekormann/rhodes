import { describe, expect, it } from "vitest";
import { nextNodePosition, resolveMindMapRelationField } from "@/lib/views/mindmap";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";

describe("nextNodePosition", () => {
  it("returns a default position for an empty layout", () => {
    expect(nextNodePosition({})).toEqual({ x: 240, y: 160 });
  });

  it("places subsequent nodes around the centroid without stacking exactly on top", () => {
    const layout = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
    const next = nextNodePosition(layout);
    expect(next).not.toEqual({ x: 50, y: 0 });
    expect(Number.isFinite(next.x)).toBe(true);
    expect(Number.isFinite(next.y)).toBe(true);
  });
});

describe("resolveMindMapRelationField", () => {
  it("returns the first relation-type schema field", () => {
    const schemas: MetadataSchemaField[] = [
      { id: "1", workspace_id: "ws", field_key: "status", field_label: "Status", field_type: "status", options: null, created_at: "" },
      { id: "2", workspace_id: "ws", field_key: "related_to", field_label: "Related to", field_type: "relation", options: null, created_at: "" },
      { id: "3", workspace_id: "ws", field_key: "parent", field_label: "Parent", field_type: "relation", options: null, created_at: "" },
    ];
    expect(resolveMindMapRelationField(schemas)?.field_key).toBe("related_to");
    expect(resolveMindMapRelationField([])).toBeNull();
  });

  it("prefers config.relationField when it matches a relation schema", () => {
    const schemas: MetadataSchemaField[] = [
      { id: "2", workspace_id: "ws", field_key: "related_to", field_label: "Related to", field_type: "relation", options: null, created_at: "" },
      { id: "3", workspace_id: "ws", field_key: "parent", field_label: "Parent", field_type: "relation", options: null, created_at: "" },
    ];
    expect(
      resolveMindMapRelationField(schemas, { relationField: "parent" })?.field_key,
    ).toBe("parent");
  });
});
