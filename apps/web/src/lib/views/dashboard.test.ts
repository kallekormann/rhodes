import { describe, expect, it } from "vitest";
import { resolveDashboardConfig } from "@rhodes/shared/view-engine";
import { computeWidgetResult, type DashboardDocument } from "@/lib/views/dashboard";

describe("resolveDashboardConfig", () => {
  it("drops malformed widgets and keeps valid ones", () => {
    const config = resolveDashboardConfig({
      widgets: [
        { id: "1", type: "stat", title: "Revenue", field: "revenue", aggregation: "sum" },
        { id: "2", type: "not-a-type", title: "Bad", field: "x" },
        { not: "a widget" },
      ],
    });
    expect(config?.widgets).toEqual([
      { id: "1", type: "stat", title: "Revenue", field: "revenue", aggregation: "sum" },
    ]);
  });

  it("returns null for missing config", () => {
    expect(resolveDashboardConfig(null)).toBeNull();
  });
});

describe("computeWidgetResult", () => {
  const documents: DashboardDocument[] = [
    { id: "a", title: "Doc A", metadata: { revenue: 100, region: "EU" } },
    { id: "b", title: "Doc B", metadata: { revenue: 50, region: "US" } },
    { id: "c", title: "Doc C", metadata: { revenue: 25, region: "EU" } },
    { id: "d", title: "Doc D", metadata: {} },
  ];

  it("computes a count stat", () => {
    const result = computeWidgetResult(
      { id: "w1", type: "stat", title: "Total docs", field: "revenue" },
      documents,
    );
    expect(result).toEqual({ id: "w1", type: "stat", title: "Total docs", value: 4 });
  });

  it("computes a sum stat over a numeric field", () => {
    const result = computeWidgetResult(
      { id: "w2", type: "stat", title: "Total revenue", field: "revenue", aggregation: "sum" },
      documents,
    );
    expect(result).toEqual({ id: "w2", type: "stat", title: "Total revenue", value: 175 });
  });

  it("groups a breakdown widget by groupByField", () => {
    const result = computeWidgetResult(
      {
        id: "w3",
        type: "breakdown",
        title: "By region",
        field: "revenue",
        groupByField: "region",
        aggregation: "sum",
      },
      documents,
    );
    expect(result).toEqual({
      id: "w3",
      type: "breakdown",
      title: "By region",
      groups: [
        { label: "EU", value: 125 },
        { label: "US", value: 50 },
        { label: "Unset", value: 0 },
      ],
    });
  });

  it("applies an eq filter before aggregating", () => {
    const result = computeWidgetResult(
      {
        id: "w4",
        type: "stat",
        title: "EU docs",
        field: "revenue",
        filter: { field: "region", op: "eq", value: "EU" },
      },
      documents,
    );
    expect(result).toEqual({ id: "w4", type: "stat", title: "EU docs", value: 2 });
  });

  it("builds a list widget of display values", () => {
    const result = computeWidgetResult(
      { id: "w5", type: "list", title: "Docs", field: "region" },
      documents,
    );
    expect(result).toEqual({
      id: "w5",
      type: "list",
      title: "Docs",
      items: [
        { id: "a", title: "Doc A", value: "EU" },
        { id: "b", title: "Doc B", value: "US" },
        { id: "c", title: "Doc C", value: "EU" },
        { id: "d", title: "Doc D", value: "—" },
      ],
    });
  });
});
