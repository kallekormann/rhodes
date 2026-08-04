import { describe, expect, it } from "vitest";
import {
  buildRelationEdges,
  computeDegrees,
  detectCommunities,
  relationFields,
  type GraphDocument,
} from "@/lib/views/relation-graph";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";

const linkField: MetadataSchemaField = {
  id: "1",
  workspace_id: "ws",
  field_key: "related_to",
  field_label: "Related to",
  field_type: "relation",
  options: null,
  created_at: "",
};

describe("relationFields", () => {
  it("filters to relation-type schema fields, optionally by allowlist", () => {
    const textField: MetadataSchemaField = { ...linkField, id: "2", field_key: "title", field_type: "text" };
    expect(relationFields([linkField, textField]).map((f) => f.field_key)).toEqual(["related_to"]);
    expect(relationFields([linkField], ["other"])).toEqual([]);
    expect(relationFields([linkField], ["related_to"])).toEqual([linkField]);
  });
});

describe("buildRelationEdges", () => {
  it("derives directed edges from relation metadata values", () => {
    const docs: GraphDocument[] = [
      { id: "a", title: "A", metadata: { related_to: { document_id: "b", title: "B" } } },
      { id: "b", title: "B", metadata: {} },
      { id: "c", title: "C", metadata: { related_to: { document_id: "missing", title: "?" } } },
    ];
    const edges = buildRelationEdges(docs, [linkField]);
    expect(edges).toEqual([
      { id: "a->b:related_to", source: "a", target: "b", fieldKey: "related_to", fieldLabel: "Related to" },
    ]);
  });

  it("ignores self-references", () => {
    const docs: GraphDocument[] = [
      { id: "a", title: "A", metadata: { related_to: { document_id: "a", title: "A" } } },
    ];
    expect(buildRelationEdges(docs, [linkField])).toEqual([]);
  });
});

describe("computeDegrees", () => {
  it("counts undirected connections per document", () => {
    const docs: GraphDocument[] = [
      { id: "a", title: "A", metadata: {} },
      { id: "b", title: "B", metadata: {} },
      { id: "c", title: "C", metadata: {} },
    ];
    const edges = [
      { id: "e1", source: "a", target: "b", fieldKey: "r", fieldLabel: "R" },
      { id: "e2", source: "a", target: "c", fieldKey: "r", fieldLabel: "R" },
    ];
    const degrees = computeDegrees(docs, edges);
    expect(degrees.get("a")).toBe(2);
    expect(degrees.get("b")).toBe(1);
    expect(degrees.get("c")).toBe(1);
  });
});

describe("detectCommunities", () => {
  it("groups two disconnected clusters into separate communities", () => {
    const docs: GraphDocument[] = [
      { id: "a", title: "A", metadata: {} },
      { id: "b", title: "B", metadata: {} },
      { id: "c", title: "C", metadata: {} },
      { id: "d", title: "D", metadata: {} },
    ];
    const edges = [
      { id: "e1", source: "a", target: "b", fieldKey: "r", fieldLabel: "R" },
      { id: "e2", source: "c", target: "d", fieldKey: "r", fieldLabel: "R" },
    ];
    const communities = detectCommunities(docs, edges);
    expect(communities.get("a")).toBe(communities.get("b"));
    expect(communities.get("c")).toBe(communities.get("d"));
    expect(communities.get("a")).not.toBe(communities.get("c"));
  });
});
