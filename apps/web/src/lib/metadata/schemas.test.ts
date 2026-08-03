import { describe, expect, it } from "vitest";
import {
  parseStatusOptions,
  readMetadataFieldValue,
  readMetadataRelationValue,
  withUserMetadataValue,
  type StatusOption,
} from "@/lib/metadata/schemas";

describe("status field type", () => {
  const statusOptions: StatusOption[] = [
    { value: "backlog", label: "Backlog", category: "unstarted" },
    { value: "live", label: "Live", category: "started" },
    { value: "concluded", label: "Concluded", category: "completed" },
  ];

  it("parses well-formed status options", () => {
    expect(parseStatusOptions(statusOptions)).toEqual(statusOptions);
  });

  it("rejects options missing a valid category", () => {
    expect(parseStatusOptions([{ value: "x", label: "X" }])).toBeNull();
    expect(
      parseStatusOptions([{ value: "x", label: "X", category: "not_a_category" }]),
    ).toBeNull();
  });

  it("rejects plain string options (legacy select shape)", () => {
    expect(parseStatusOptions(["draft", "done"])).toBeNull();
  });
});

describe("relation field type", () => {
  it("reads a relation value from metadata", () => {
    const metadata = { origin: { document_id: "doc-1", title: "Insight: churn spike" } };
    expect(readMetadataRelationValue(metadata, "origin")).toEqual({
      document_id: "doc-1",
      title: "Insight: churn spike",
    });
  });

  it("returns null for missing or malformed relation values", () => {
    expect(readMetadataRelationValue({}, "origin")).toBeNull();
    expect(readMetadataRelationValue({ origin: "not-an-object" }, "origin")).toBeNull();
    expect(readMetadataRelationValue({ origin: { title: "no id" } }, "origin")).toBeNull();
  });

  it("readMetadataFieldValue dispatches relation fields correctly", () => {
    const metadata = { origin: { document_id: "doc-1", title: "Insight" } };
    expect(
      readMetadataFieldValue(metadata, { field_key: "origin", field_type: "relation" }),
    ).toEqual({ document_id: "doc-1", title: "Insight" });
  });

  it("does not treat a set relation value as empty (regression: date-range emptiness check)", () => {
    const withValue = withUserMetadataValue(null, "origin", {
      document_id: "doc-1",
      title: "Insight",
    });
    expect(withValue.origin).toEqual({ document_id: "doc-1", title: "Insight" });
  });

  it("clears a relation value when set to null", () => {
    const metadata = { origin: { document_id: "doc-1", title: "Insight" } };
    const cleared = withUserMetadataValue(metadata, "origin", null);
    expect(cleared.origin).toBeUndefined();
  });
});
