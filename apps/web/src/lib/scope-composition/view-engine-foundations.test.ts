import { describe, expect, it } from "vitest";
import {
  ADDITIONAL_SCOPE_VIEW_CATALOG,
  validateScopeCompositionViewSelection,
} from "@rhodes/shared/scope-views";
import {
  getViewPresetById,
  getViewPresetsByIds,
} from "@rhodes/shared/scope-bundles";
import {
  isViewEngineBaseType,
  KANBAN_GROUP_BY_FIELD_TYPES,
  VIEW_ENGINE_BASE_TYPES,
} from "@rhodes/shared/view-engine";
import { VIEW_TEMPLATE_AFFINITY } from "@rhodes/shared/view-template-affinity";

describe("view engine foundations", () => {
  it("splits mindmap and knowledge graph in the additional catalog", () => {
    const ids = ADDITIONAL_SCOPE_VIEW_CATALOG.map((view) => view.id);
    expect(ids).toContain("mindmap");
    expect(ids).toContain("graph");

    const mindmap = ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === "mindmap");
    const graph = ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === "graph");
    expect(mindmap?.label).toBe("Mind-Map");
    expect(graph?.label).toBe("Knowledge Graph");
    expect(ids.filter((id) => id === "graph" || id === "mindmap")).toHaveLength(2);
  });

  it("marks wiki as available in the catalog", () => {
    const wiki = ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === "wiki");
    expect(wiki?.status).toBe("available");
    expect(wiki?.label).toBe("Wiki");
  });

  it("marks kanban as available in the catalog", () => {
    const kanban = ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === "kanban");
    expect(kanban?.status).toBe("available");
  });

  it("accepts mindmap and graph in composition view selection", () => {
    const result = validateScopeCompositionViewSelection("pro", ["mindmap", "graph"]);
    expect(result).toEqual({ ok: true });
  });

  it("exposes typed base types covering the catalog engines", () => {
    for (const id of ["kanban", "calendar", "gantt", "dashboard", "mindmap", "graph", "wiki"]) {
      expect(isViewEngineBaseType(id)).toBe(true);
    }
    expect(VIEW_ENGINE_BASE_TYPES).toContain("mindmap");
    expect(KANBAN_GROUP_BY_FIELD_TYPES).toEqual(["select", "status"]);
  });

  it("resolves view presets by id from the bundle catalog", () => {
    const preset = getViewPresetById("kb-freshness-radar");
    expect(preset?.baseViewType).toBe("dashboard");
    expect(getViewPresetsByIds(["kb-freshness-radar", "missing"]).map((p) => p.id)).toEqual([
      "kb-freshness-radar",
    ]);
  });

  it("defines affinity rules for mindmap and graph", () => {
    expect(VIEW_TEMPLATE_AFFINITY.mindmap?.recommended.length).toBeGreaterThan(0);
    expect(VIEW_TEMPLATE_AFFINITY.graph?.recommended.length).toBeGreaterThan(0);
    expect(VIEW_TEMPLATE_AFFINITY.mindmap?.recommended[0]).toBe("blank");
    expect(VIEW_TEMPLATE_AFFINITY.graph?.recommended[0]).toBe("blank");
  });
});
