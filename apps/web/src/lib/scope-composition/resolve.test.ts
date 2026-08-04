import { describe, expect, it } from "vitest";
import type { BundleDefinition } from "@rhodes/shared/scope-bundles";
import {
  applyBaseViewToggle,
  resolveScopeComposition,
} from "@rhodes/shared/scope-composition";

const TEST_BUNDLE_KB: BundleDefinition = {
  id: "knowledge-base-ops",
  label: "Knowledge Base & Operations",
  description: "SOPs and onboarding",
  audience: ["operations"],
  status: "available",
  minTier: "basic",
  viewPresets: [
    {
      id: "freshness-radar",
      baseViewType: "dashboard",
      label: "Freshness radar",
      description: "Stale docs",
      config: { groupBy: "verification_status" },
    },
  ],
  templateSlugs: ["sop", "onboarding-guide"],
  metadataFields: [
    {
      field_key: "verification_status",
      field_label: "Verification status",
      field_type: "select",
      options: ["verified", "needs_update"],
    },
  ],
};

const TEST_BUNDLE_PDX: BundleDefinition = {
  id: "product-discovery-ux",
  label: "Product Discovery & UX",
  description: "PRD and discovery",
  audience: ["product"],
  status: "available",
  minTier: "basic",
  viewPresets: [
    {
      id: "discovery-matrix",
      baseViewType: "kanban",
      label: "Discovery matrix",
      description: "Impact vs effort",
      config: {},
    },
  ],
  templateSlugs: ["product-spec", "meeting-notes"],
  metadataFields: [
    {
      field_key: "lifecycle_phase",
      field_label: "Lifecycle phase",
      field_type: "select",
      options: ["discovery", "definition", "live"],
    },
  ],
};

const TEST_BUNDLES = [TEST_BUNDLE_KB, TEST_BUNDLE_PDX];

describe("resolveScopeComposition", () => {
  it("infers templates when a base view is selected", () => {
    const result = resolveScopeComposition(
      {
        selectedBaseViewIds: ["kanban"],
        selectedViewPresetIds: [],
        selectedTemplateSlugs: [],
        selectedBundleIds: [],
        tier: "pro",
      },
      { bundles: TEST_BUNDLES },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.enabledViews).toContain("kanban");
    expect(result.templateSlugs).toContain("project-kickoff");
    expect(result.inferred.addedTemplates.length).toBeGreaterThan(0);
  });

  it("always includes the blank template", () => {
    const result = resolveScopeComposition(
      {
        selectedBaseViewIds: [],
        selectedViewPresetIds: [],
        selectedTemplateSlugs: [],
        selectedBundleIds: [],
        tier: "pro",
      },
      { bundles: TEST_BUNDLES },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.templateSlugs).toContain("blank");
    expect(result.metadataFields.some((f) => f.field_key === "origin")).toBe(true);
  });

  it("does not force-enable views from templates alone", () => {
    const result = resolveScopeComposition(
      {
        selectedBaseViewIds: [],
        selectedViewPresetIds: [],
        selectedTemplateSlugs: ["product-spec"],
        selectedBundleIds: [],
        tier: "pro",
      },
      { bundles: TEST_BUNDLES },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.enabledViews).not.toContain("kanban");
    expect(result.enabledViews).toEqual([]);
    expect(result.templateSlugs).toContain("product-spec");
    expect(result.templateSlugs).toContain("blank");
  });

  it("enables page types from bundle presets without counting presets as views", () => {
    const result = resolveScopeComposition(
      {
        selectedBaseViewIds: [],
        selectedViewPresetIds: [],
        selectedTemplateSlugs: [],
        selectedBundleIds: ["product-discovery-ux"],
        tier: "pro",
      },
      { bundles: TEST_BUNDLES },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.enabledViews).toEqual(["kanban"]);
    expect(result.viewPresetIds).toContain("discovery-matrix");
    expect(result.setupConfig.baseViewIds).toEqual([]);
  });

  it("unions multiple bundles", () => {
    const result = resolveScopeComposition(
      {
        selectedBaseViewIds: [],
        selectedViewPresetIds: [],
        selectedTemplateSlugs: [],
        selectedBundleIds: ["knowledge-base-ops", "product-discovery-ux"],
        tier: "pro",
      },
      { bundles: TEST_BUNDLES },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.bundleIds).toEqual([
      "knowledge-base-ops",
      "product-discovery-ux",
    ]);
    expect(result.enabledViews).toContain("dashboard");
    expect(result.enabledViews).toContain("kanban");
    expect(result.templateSlugs).toEqual(
      expect.arrayContaining(["sop", "onboarding-guide", "product-spec", "meeting-notes"]),
    );
    expect(result.metadataFields.map((f) => f.field_key)).toEqual(
      expect.arrayContaining(["verification_status", "lifecycle_phase"]),
    );
    expect(result.viewPresetIds).toEqual(
      expect.arrayContaining(["freshness-radar", "discovery-matrix"]),
    );
  });

  it("dedupes overlapping bundle selections", () => {
    const result = resolveScopeComposition(
      {
        selectedBaseViewIds: [],
        selectedViewPresetIds: [],
        selectedTemplateSlugs: [],
        selectedBundleIds: ["knowledge-base-ops", "knowledge-base-ops"],
        tier: "pro",
      },
      { bundles: TEST_BUNDLES },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundleIds).toEqual(["knowledge-base-ops"]);
  });

  it("rejects selections above tier view limit", () => {
    const result = resolveScopeComposition(
      {
        selectedBaseViewIds: ["kanban", "calendar", "gantt", "wiki", "dashboard"],
        selectedViewPresetIds: [],
        selectedTemplateSlugs: [],
        selectedBundleIds: [],
        tier: "free",
      },
      { bundles: TEST_BUNDLES },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/up to 1 additional/);
  });

  it("rejects unavailable bundles for tier", () => {
    const proOnlyBundle: BundleDefinition = {
      ...TEST_BUNDLE_KB,
      id: "pro-only",
      minTier: "pro",
    };

    const result = resolveScopeComposition(
      {
        selectedBaseViewIds: [],
        selectedViewPresetIds: [],
        selectedTemplateSlugs: [],
        selectedBundleIds: ["pro-only"],
        tier: "free",
      },
      { bundles: [proOnlyBundle] },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/not available/);
  });

  it("cascades recommended templates when toggling a page type", () => {
    const enabled = applyBaseViewToggle(
      {
        selectedBaseViewIds: [],
        selectedViewPresetIds: [],
        selectedTemplateSlugs: [],
        selectedBundleIds: [],
      },
      "kanban",
      { currentlyEnabled: false, bundles: TEST_BUNDLES },
    );

    expect(enabled.selectedBaseViewIds).toEqual(["kanban"]);
    expect(enabled.selectedTemplateSlugs).toContain("project-kickoff");
    expect(enabled.selectedTemplateSlugs).toContain("meeting-notes");

    const disabled = applyBaseViewToggle(enabled, "kanban", {
      currentlyEnabled: true,
      bundles: TEST_BUNDLES,
    });

    expect(disabled.selectedBaseViewIds).toEqual([]);
    expect(disabled.selectedTemplateSlugs).not.toContain("project-kickoff");
    expect(disabled.selectedTemplateSlugs).not.toContain("meeting-notes");
  });

  it("keeps bundle-locked page types when toggled off", () => {
    const draft = {
      selectedBaseViewIds: [],
      selectedViewPresetIds: [],
      selectedTemplateSlugs: [],
      selectedBundleIds: ["product-discovery-ux"],
    };
    const next = applyBaseViewToggle(draft, "kanban", {
      currentlyEnabled: true,
      bundles: TEST_BUNDLES,
    });
    expect(next).toEqual(draft);
  });
});
