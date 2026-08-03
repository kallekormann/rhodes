import { describe, expect, it } from "vitest";
import {
  ESSENTIAL_TEMPLATE_FIELD_KEYS,
  SYSTEM_TEMPLATE_SEEDS,
} from "@rhodes/shared/system-templates";
import {
  documentMetadataFromTemplate,
  parseTemplateMetadata,
} from "@/lib/templates/metadata";

describe("SYSTEM_TEMPLATE_SEEDS", () => {
  it("includes all wizard catalog slugs", () => {
    const slugs = SYSTEM_TEMPLATE_SEEDS.map((seed) => seed.slug).sort();
    expect(slugs).toEqual(["blank", "meeting-notes", "product-spec", "report"]);
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
