import { describe, expect, it } from "vitest";
import {
  ESSENTIAL_TEMPLATE_FIELD_KEYS,
  SYSTEM_TEMPLATE_SEEDS,
} from "@rhodes/shared/system-templates";
import { parseStatusOptions } from "@/lib/metadata/schemas";
import {
  documentMetadataFromTemplate,
  parseTemplateMetadata,
} from "@/lib/templates/metadata";

describe("SYSTEM_TEMPLATE_SEEDS", () => {
  it("includes all wizard catalog slugs", () => {
    const slugs = SYSTEM_TEMPLATE_SEEDS.map((seed) => seed.slug).sort();
    expect(slugs).toEqual([
      "ab-experiment",
      "blank",
      "insight",
      "meeting-notes",
      "onboarding-guide",
      "policy-document",
      "problem",
      "product-spec",
      "report",
      "scientific-experiment",
      "sop",
    ]);
  });

  it("Knowledge Base & Ops templates ship freshness fields", () => {
    const kbSlugs = ["sop", "onboarding-guide", "policy-document"];
    for (const slug of kbSlugs) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      for (const key of ["verification_status", "last_audited", "review_cycle"]) {
        const field = seed?.metadata.schema_fields.find((f) => f.field_key === key);
        expect(field, `${slug} missing ${key}`).toBeTruthy();
      }
      expect(seed?.metadata.supported_views).toContain("wiki");
    }
  });

  it("Growth & Experimentation templates ship discovery/experiment fields without colliding with essentials", () => {
    const discoverySlugs = ["insight", "problem"];
    for (const slug of discoverySlugs) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      for (const key of ["state", "source_type", "confidence_level", "product_area"]) {
        const field = seed?.metadata.schema_fields.find((f) => f.field_key === key);
        expect(field, `${slug} missing ${key}`).toBeTruthy();
      }
      const state = seed?.metadata.schema_fields.find((f) => f.field_key === "state");
      expect(state?.field_type).toBe("status");
      expect(parseStatusOptions(state?.options)?.length).toBeGreaterThan(0);
    }

    for (const slug of ["ab-experiment", "scientific-experiment"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();

      // Regression: a custom `status`-type field must not collide with (and get
      // silently dropped by) the essential `status` select field — it needs its own key.
      const essentialStatus = seed?.metadata.schema_fields.find((f) => f.field_key === "status");
      expect(essentialStatus?.field_type).toBe("select");

      const experimentStatus = seed?.metadata.schema_fields.find(
        (f) => f.field_key === "experiment_status",
      );
      expect(experimentStatus, `${slug} missing experiment_status`).toBeTruthy();
      expect(experimentStatus?.field_type).toBe("status");
      expect(parseStatusOptions(experimentStatus?.options)?.length).toBeGreaterThan(0);
    }

    const abExperiment = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "ab-experiment");
    expect(
      abExperiment?.metadata.schema_fields.find((f) => f.field_key === "origin")?.field_type,
    ).toBe("relation");
  });

  it("ships essentials with field_type and AI fill", () => {
    for (const seed of SYSTEM_TEMPLATE_SEEDS) {
      for (const key of ESSENTIAL_TEMPLATE_FIELD_KEYS) {
        const field = seed.metadata.schema_fields.find((f) => f.field_key === key);
        expect(field, `${seed.slug} missing ${key}`).toBeTruthy();
        expect(field?.ai_fill_enabled).toBe(true);
        expect(field?.field_type).toBeTruthy();
      }
      expect(seed.metadata.document_type).toBeTruthy();
      expect(
        seed.metadata.schema_fields.some((f) => f.field_key === "document_type"),
      ).toBe(false);
    }
  });

  it("includes italic tip paragraphs under section headings", () => {
    for (const seed of SYSTEM_TEMPLATE_SEEDS) {
      if (seed.slug === "blank") continue;
      const content = seed.structure_json.content as Array<Record<string, unknown>>;
      const headings = content.filter((node) => node.type === "heading");
      expect(headings.length).toBeGreaterThan(0);
      const tips = content.filter((node) => {
        if (node.type !== "paragraph") return false;
        const children = node.content as Array<Record<string, unknown>> | undefined;
        const first = children?.[0];
        const marks = first?.marks as Array<{ type: string }> | undefined;
        return marks?.some((mark) => mark.type === "italic");
      });
      expect(tips.length).toBeGreaterThan(0);
    }
  });
});

describe("parseTemplateMetadata", () => {
  it("preserves schema_fields, document_type, and typed defaults", () => {
    const parsed = parseTemplateMetadata({
      document_type: "meeting_notes",
      use_cases: ["Syncs"],
      supported_views: ["calendar"],
      schema_fields: [
        {
          field_key: "meeting_date",
          field_label: "Meeting date",
          field_type: "date",
          ai_fill_enabled: true,
        },
      ],
      default_properties: { status: "draft" },
    });

    expect(parsed.document_type).toBe("meeting_notes");
    expect(parsed.schema_fields?.[0]?.field_type).toBe("date");
    expect(parsed.default_properties?.status).toBe("draft");
  });

  it("flattens classification onto document metadata", () => {
    const meta = documentMetadataFromTemplate({
      document_type: "report",
      default_properties: { status: "draft" },
    });
    expect(meta).toEqual({ status: "draft", document_type: "report" });
  });
});
