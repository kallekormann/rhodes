import { describe, expect, it } from "vitest";
import { createEmptyWikiLayout } from "@rhodes/shared/view-engine";
import {
  appendChildOrder,
  buildWikiTree,
  resolveWikiDrop,
  parentMapFromDocuments,
  wouldCreateCycle,
  wikiBreadcrumb,
  type WikiDocument,
} from "./wiki";

const docs = (rows: Array<[string, string, string | null]>): WikiDocument[] =>
  rows.map(([id, title, parent]) => ({
    id,
    title,
    metadata: parent
      ? { origin: { document_id: parent, title: "Parent" } }
      : {},
  }));

describe("buildWikiTree", () => {
  it("nests Origin children under the Space root with layout order", () => {
    const documents = docs([
      ["root", "Space", null],
      ["a", "Alpha", "root"],
      ["b", "Beta", "root"],
      ["a1", "Alpha child", "a"],
      ["orphan", "Outside", null],
    ]);
    const layout = {
      v: 1 as const,
      order: { root: ["b", "a"], a: ["a1"] },
    };
    const tree = buildWikiTree(documents, "root", layout);
    expect(tree?.id).toBe("root");
    expect(tree?.children.map((c) => c.id)).toEqual(["b", "a"]);
    expect(tree?.children[1]?.children.map((c) => c.id)).toEqual(["a1"]);
    expect(JSON.stringify(tree)).not.toContain("orphan");
  });

  it("returns null when root is missing", () => {
    expect(buildWikiTree(docs([["a", "A", null]]), "missing", {})).toBeNull();
  });
});

describe("wouldCreateCycle", () => {
  it("detects ancestor cycles", () => {
    const parentByChild = new Map<string, string | null>([
      ["root", null],
      ["a", "root"],
      ["b", "a"],
    ]);
    expect(wouldCreateCycle(parentByChild, "a", "b")).toBe(true);
    expect(wouldCreateCycle(parentByChild, "b", "root")).toBe(false);
  });
});

describe("resolveWikiDrop", () => {
  const documents = docs([
    ["root", "Space", null],
    ["a", "A", "root"],
    ["b", "B", "root"],
    ["a1", "A1", "a"],
  ]);
  const { parentByChild, childrenByParent } = parentMapFromDocuments(documents);

  it("reparents on drop onto a page", () => {
    const result = resolveWikiDrop({
      draggedId: "b",
      targetId: "a",
      dropPosition: "on",
      rootId: "root",
      parentByChild,
      childrenByParent,
    });
    expect(result).toEqual({
      kind: "reparent",
      childId: "b",
      newParentId: "a",
      previousParentId: "root",
    });
  });

  it("rejects nesting under a descendant", () => {
    const result = resolveWikiDrop({
      draggedId: "a",
      targetId: "a1",
      dropPosition: "on",
      rootId: "root",
      parentByChild,
      childrenByParent,
    });
    expect(result.kind).toBe("invalid");
  });

  it("reorders among siblings", () => {
    const result = resolveWikiDrop({
      draggedId: "b",
      targetId: "a",
      dropPosition: "before",
      rootId: "root",
      parentByChild,
      childrenByParent,
    });
    expect(result).toEqual({
      kind: "reorder",
      parentId: "root",
      orderedChildIds: ["b", "a"],
    });
  });

  it("reparents when dropping before a node under another parent", () => {
    const result = resolveWikiDrop({
      draggedId: "b",
      targetId: "a1",
      dropPosition: "before",
      rootId: "root",
      parentByChild,
      childrenByParent,
    });
    expect(result).toEqual({
      kind: "reparent",
      childId: "b",
      newParentId: "a",
      previousParentId: "root",
      orderedChildIds: ["b", "a1"],
    });
  });
});

describe("layout helpers", () => {
  it("appends child order idempotently", () => {
    let layout = createEmptyWikiLayout();
    layout = appendChildOrder(layout, "root", "a");
    layout = appendChildOrder(layout, "root", "a");
    expect(layout.order.root).toEqual(["a"]);
  });
});

describe("wikiBreadcrumb", () => {
  it("returns path from root to node", () => {
    const tree = buildWikiTree(
      docs([
        ["root", "Space", null],
        ["a", "A", "root"],
        ["a1", "A1", "a"],
      ]),
      "root",
      createEmptyWikiLayout(),
    );
    expect(wikiBreadcrumb(tree, "a1").map((n) => n.id)).toEqual([
      "root",
      "a",
      "a1",
    ]);
  });
});
