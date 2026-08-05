import { describe, expect, it } from "vitest";
import {
  createEmptyMindMapLayout,
  normalizeMindMapLayout,
} from "@rhodes/shared/view-engine";
import {
  addMindMapChildNode,
  bindDocumentToMindMapNode,
  collectSubtreeNodeIds,
  mindMapNeedsGuidedSetup,
  pickMindMapRootSide,
  reparentMindMapNode,
  resolveMindMapNodeSide,
  resolveMindMapRelationField,
  resolveMindMapReparentFromConnect,
  resolveMindMapReparentFromReconnect,
} from "@/lib/views/mindmap";
import {
  layoutMindMapTree,
  mindMapHandleForSide,
  sideFromHandleId,
} from "@/lib/views/mindmap-layout";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";

describe("normalizeMindMapLayout", () => {
  it("creates a placeholder root for empty input", () => {
    const layout = normalizeMindMapLayout(null);
    expect(layout.v).toBe(2);
    expect(layout.nodes[layout.rootId]?.documentId).toBeNull();
    expect(mindMapNeedsGuidedSetup(layout)).toBe(true);
  });

  it("migrates a single legacy v1 node into a document root", () => {
    const layout = normalizeMindMapLayout({
      "doc-a": { x: 10, y: 20 },
    });
    expect(layout.v).toBe(2);
    expect(layout.rootId).toBe("doc-a");
    expect(layout.nodes["doc-a"]?.documentId).toBe("doc-a");
    expect(layout.nodes["doc-a"]?.parentId).toBeNull();
    expect(mindMapNeedsGuidedSetup(layout)).toBe(false);
  });

  it("migrates multiple legacy v1 nodes under a placeholder root with sides", () => {
    const layout = normalizeMindMapLayout({
      "doc-a": { x: 10, y: 20 },
      "doc-b": { x: 30, y: 40 },
    });
    expect(layout.v).toBe(2);
    expect(layout.nodes["doc-a"]?.documentId).toBe("doc-a");
    expect(layout.nodes["doc-a"]?.parentId).toBe(layout.rootId);
    expect(layout.nodes["doc-b"]?.parentId).toBe(layout.rootId);
    expect(layout.nodes["doc-a"]?.side).toBe("right");
    expect(layout.nodes["doc-b"]?.side).toBe("left");
    expect(mindMapNeedsGuidedSetup(layout)).toBe(true);
  });
});

describe("mind map tree helpers", () => {
  it("binds a document to the placeholder root and replaces the local id", () => {
    const empty = createEmptyMindMapLayout();
    const bound = bindDocumentToMindMapNode(empty, empty.rootId, "doc-root");
    expect(bound.rootId).toBe("doc-root");
    expect(bound.nodes["doc-root"]?.documentId).toBe("doc-root");
    expect(bound.nodes[empty.rootId]).toBeUndefined();
    expect(mindMapNeedsGuidedSetup(bound)).toBe(false);
  });

  it("adds children and collects subtrees", () => {
    let layout = createEmptyMindMapLayout();
    layout = bindDocumentToMindMapNode(layout, layout.rootId, "root-doc");
    layout = addMindMapChildNode(layout, layout.rootId, "child-1", {
      x: 100,
      y: 100,
    });
    layout = addMindMapChildNode(layout, "child-1", "child-2", {
      x: 200,
      y: 200,
    });
    expect(collectSubtreeNodeIds(layout, "child-1")).toEqual([
      "child-1",
      "child-2",
    ]);
    expect(layout.nodes["child-1"]?.side).toBe("right");
    expect(layout.nodes["child-2"]?.side).toBe("right");
  });

  it("balances new root children across left and right", () => {
    let layout = createEmptyMindMapLayout();
    layout = bindDocumentToMindMapNode(layout, layout.rootId, "root-doc");
    expect(pickMindMapRootSide(layout)).toBe("right");
    layout = addMindMapChildNode(layout, layout.rootId, "a", { x: 0, y: 0 });
    expect(layout.nodes.a?.side).toBe("right");
    expect(pickMindMapRootSide(layout)).toBe("left");
    layout = addMindMapChildNode(layout, layout.rootId, "b", { x: 0, y: 0 });
    expect(layout.nodes.b?.side).toBe("left");
  });

  it("reparents without creating cycles and can flip branch side", () => {
    let layout = createEmptyMindMapLayout();
    layout = bindDocumentToMindMapNode(layout, layout.rootId, "root-doc");
    layout = addMindMapChildNode(layout, layout.rootId, "a", { x: 0, y: 0 });
    layout = addMindMapChildNode(layout, "a", "b", { x: 0, y: 0 });
    const blocked = reparentMindMapNode(layout, "a", "b");
    expect(blocked.nodes.a?.parentId).toBe(layout.rootId);

    const flipped = reparentMindMapNode(layout, "a", layout.rootId, "left");
    expect(flipped.nodes.a?.parentId).toBe(layout.rootId);
    expect(flipped.nodes.a?.side).toBe("left");
    expect(flipped.nodes.b?.side).toBe("left");
  });

  it("lays out left and right branches on opposite sides of the root", () => {
    let layout = createEmptyMindMapLayout();
    layout = bindDocumentToMindMapNode(layout, layout.rootId, "root-doc");
    layout = addMindMapChildNode(
      layout,
      layout.rootId,
      "right-child",
      { x: 0, y: 0 },
      "right-child",
      "right",
    );
    layout = addMindMapChildNode(
      layout,
      layout.rootId,
      "left-child",
      { x: 0, y: 0 },
      "left-child",
      "left",
    );
    layout = addMindMapChildNode(
      layout,
      "right-child",
      "right-grand",
      { x: 0, y: 0 },
      "right-grand",
      "right",
    );
    const next = layoutMindMapTree(layout);
    const rootX = next.nodes[next.rootId]!.x;
    expect(next.nodes["right-child"]!.x).toBeGreaterThan(rootX);
    expect(next.nodes["left-child"]!.x).toBeLessThan(rootX);
    expect(next.nodes["right-grand"]!.x).toBeGreaterThan(
      next.nodes["right-child"]!.x,
    );

    const flipped = layoutMindMapTree(
      reparentMindMapNode(next, "right-child", next.rootId, "left"),
    );
    expect(flipped.nodes["right-child"]!.x).toBeLessThan(
      flipped.nodes[flipped.rootId]!.x,
    );
    expect(flipped.nodes["right-grand"]!.x).toBeLessThan(
      flipped.nodes["right-child"]!.x,
    );
    expect(flipped.nodes["right-grand"]!.side).toBe("left");
  });

  it("maps handle ids to sides", () => {
    expect(sideFromHandleId("left")).toBe("left");
    expect(sideFromHandleId("right")).toBe("right");
    expect(mindMapHandleForSide("left")).toBe("left");
    expect(mindMapHandleForSide("right")).toBe("right");
    expect(resolveMindMapNodeSide(createEmptyMindMapLayout(), "missing")).toBe(
      "right",
    );
  });
});

describe("resolveMindMapReparent endpoints", () => {
  function sampleTree() {
    let layout = createEmptyMindMapLayout();
    layout = bindDocumentToMindMapNode(layout, layout.rootId, "root");
    layout = addMindMapChildNode(layout, "root", "a", { x: 100, y: 0 }, "a");
    layout = addMindMapChildNode(layout, "root", "b", { x: -100, y: 0 }, "b");
    layout = addMindMapChildNode(layout, "a", "a1", { x: 200, y: 0 }, "a1");
    layout = addMindMapChildNode(layout, "b", "b1", { x: -200, y: 0 }, "b1");
    return layout;
  }

  it("treats drag-from as the child and drop-on as the new parent", () => {
    const layout = sampleTree();
    // Drag a1 onto b1 → a1 should become child of b1 (not the reverse).
    expect(resolveMindMapReparentFromConnect(layout, "a1", "b1")).toEqual({
      parentId: "b1",
      childId: "a1",
    });
  });

  it("keeps root as parent when either endpoint is the root", () => {
    const layout = sampleTree();
    expect(resolveMindMapReparentFromConnect(layout, "root", "b1")).toEqual({
      parentId: "root",
      childId: "b1",
    });
    expect(resolveMindMapReparentFromConnect(layout, "a1", "root")).toEqual({
      parentId: "root",
      childId: "a1",
    });
  });

  it("reconnect keeps the original edge target as the child", () => {
    const layout = sampleTree();
    expect(
      resolveMindMapReparentFromReconnect(
        layout,
        { source: "a", target: "a1" },
        { source: "b1", target: "a1" },
      ),
    ).toEqual({ parentId: "b1", childId: "a1" });

    // Child end dragged onto new parent (child missing from next endpoints).
    expect(
      resolveMindMapReparentFromReconnect(
        layout,
        { source: "a", target: "a1" },
        { source: "a", target: "b1" },
      ),
    ).toEqual({ parentId: "b1", childId: "a1" });
  });
});

describe("resolveMindMapRelationField", () => {
  it("returns the first relation-type schema field", () => {
    const schemas: MetadataSchemaField[] = [
      {
        id: "1",
        workspace_id: "ws",
        field_key: "status",
        field_label: "Status",
        field_type: "status",
        options: null,
        created_at: "",
      },
      {
        id: "2",
        workspace_id: "ws",
        field_key: "related_to",
        field_label: "Related to",
        field_type: "relation",
        options: null,
        created_at: "",
      },
      {
        id: "3",
        workspace_id: "ws",
        field_key: "parent",
        field_label: "Parent",
        field_type: "relation",
        options: null,
        created_at: "",
      },
    ];
    expect(resolveMindMapRelationField(schemas)?.field_key).toBe("related_to");
    expect(resolveMindMapRelationField([])).toBeNull();
  });

  it("prefers config.relationField when it matches a relation schema", () => {
    const schemas: MetadataSchemaField[] = [
      {
        id: "2",
        workspace_id: "ws",
        field_key: "related_to",
        field_label: "Related to",
        field_type: "relation",
        options: null,
        created_at: "",
      },
      {
        id: "3",
        workspace_id: "ws",
        field_key: "parent",
        field_label: "Parent",
        field_type: "relation",
        options: null,
        created_at: "",
      },
    ];
    expect(
      resolveMindMapRelationField(schemas, { relationField: "parent" })?.field_key,
    ).toBe("parent");
  });
});
