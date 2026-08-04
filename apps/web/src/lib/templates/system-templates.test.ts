import { describe, expect, it } from "vitest";
import {
  ESSENTIAL_TEMPLATE_FIELD_KEYS,
  SYSTEM_TEMPLATE_SEEDS,
  resolveTemplateSchemaFieldKeys,
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
      "adr",
      "blank",
      "business-plan",
      "campaign-brief",
      "compliance-checklist",
      "contract-review",
      "digital-maturity-audit",
      "editorial-calendar",
      "financial-report",
      "general-audit",
      "gtm-plan",
      "insight",
      "job-description",
      "launch-checklist",
      "legal-document",
      "literature-review",
      "meeting-notes",
      "onboarding-guide",
      "one-on-one-notes",
      "performance-review",
      "personal-development-plan",
      "policy-document",
      "prd",
      "problem",
      "product-feature",
      "product-spec",
      "professional-business-letter",
      "project-charter",
      "report",
      "research-paper",
      "scientific-experiment",
      "seo-brief",
      "social-post-batch",
      "sop",
      "student-essay",
      "swot-analysis",
      "technical-requirements-document",
      "thesis",
      "user-flow-definition",
      "weekly-status",
      "workflow-definition",
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

  it("Product Architecture templates ship impact_area and their own status keys without colliding with essentials", () => {
    for (const slug of ["adr", "technical-requirements-document"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      const impactArea = seed?.metadata.schema_fields.find((f) => f.field_key === "impact_area");
      expect(impactArea, `${slug} missing impact_area`).toBeTruthy();
      expect(impactArea?.field_type).toBe("multi_select");
    }

    const adr = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "adr");
    const essentialStatus = adr?.metadata.schema_fields.find((f) => f.field_key === "status");
    expect(essentialStatus?.field_type).toBe("select");

    const decisionStatus = adr?.metadata.schema_fields.find((f) => f.field_key === "decision_status");
    expect(decisionStatus?.field_type).toBe("status");
    expect(parseStatusOptions(decisionStatus?.options)?.length).toBeGreaterThan(0);

    const workflowDefinition = SYSTEM_TEMPLATE_SEEDS.find(
      (entry) => entry.slug === "workflow-definition",
    );
    const workflowStatus = workflowDefinition?.metadata.schema_fields.find(
      (f) => f.field_key === "workflow_status",
    );
    expect(workflowStatus?.field_type).toBe("status");
    expect(parseStatusOptions(workflowStatus?.options)?.length).toBeGreaterThan(0);
  });

  it("Product Discovery & UX templates ship product_area and their own status keys without colliding with essentials", () => {
    for (const slug of ["prd", "product-feature", "user-flow-definition"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      const productArea = seed?.metadata.schema_fields.find((f) => f.field_key === "product_area");
      expect(productArea, `${slug} missing product_area`).toBeTruthy();
    }

    const productFeature = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "product-feature");
    const essentialStatus = productFeature?.metadata.schema_fields.find((f) => f.field_key === "status");
    expect(essentialStatus?.field_type).toBe("select");

    const featureStatus = productFeature?.metadata.schema_fields.find(
      (f) => f.field_key === "feature_status",
    );
    expect(featureStatus?.field_type).toBe("status");
    expect(parseStatusOptions(featureStatus?.options)?.length).toBeGreaterThan(0);

    const userFlow = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "user-flow-definition");
    const flowStatus = userFlow?.metadata.schema_fields.find((f) => f.field_key === "flow_status");
    expect(flowStatus?.field_type).toBe("status");
    expect(parseStatusOptions(flowStatus?.options)?.length).toBeGreaterThan(0);

    const swot = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "swot-analysis");
    expect(swot, "missing swot-analysis").toBeTruthy();
    expect(swot?.metadata.supported_views).toContain("wiki");
  });

  it("GTM & Project Execution templates ship sponsor/status workflow fields without colliding with essentials", () => {
    for (const slug of ["project-charter", "gtm-plan"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      const sponsor = seed?.metadata.schema_fields.find((f) => f.field_key === "sponsor");
      expect(sponsor, `${slug} missing sponsor`).toBeTruthy();
    }

    const gtmPlan = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "gtm-plan");
    const essentialStatus = gtmPlan?.metadata.schema_fields.find((f) => f.field_key === "status");
    expect(essentialStatus?.field_type).toBe("select");
    const gtmStatus = gtmPlan?.metadata.schema_fields.find((f) => f.field_key === "gtm_status");
    expect(gtmStatus?.field_type).toBe("status");
    expect(parseStatusOptions(gtmStatus?.options)?.length).toBeGreaterThan(0);

    const launchChecklist = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "launch-checklist");
    const launchStatus = launchChecklist?.metadata.schema_fields.find(
      (f) => f.field_key === "launch_status",
    );
    expect(launchStatus?.field_type).toBe("status");
    expect(parseStatusOptions(launchStatus?.options)?.length).toBeGreaterThan(0);

    const weeklyStatus = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "weekly-status");
    expect(weeklyStatus, "missing weekly-status").toBeTruthy();
    const health = weeklyStatus?.metadata.schema_fields.find((f) => f.field_key === "health");
    expect(health?.field_type).toBe("status");
  });

  it("Content & Campaign Marketing templates ship campaign relation and their own status keys without colliding with essentials", () => {
    for (const slug of ["editorial-calendar", "seo-brief", "social-post-batch"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      const campaign = seed?.metadata.schema_fields.find((f) => f.field_key === "campaign");
      expect(campaign?.field_type, `${slug} missing campaign relation`).toBe("relation");
    }

    const campaignBrief = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "campaign-brief");
    expect(campaignBrief, "missing campaign-brief").toBeTruthy();
    const essentialStatus = campaignBrief?.metadata.schema_fields.find((f) => f.field_key === "status");
    expect(essentialStatus?.field_type).toBe("select");
    const campaignStatus = campaignBrief?.metadata.schema_fields.find(
      (f) => f.field_key === "campaign_status",
    );
    expect(campaignStatus?.field_type).toBe("status");
    expect(parseStatusOptions(campaignStatus?.options)?.length).toBeGreaterThan(0);

    const editorialCalendar = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "editorial-calendar");
    const contentStatus = editorialCalendar?.metadata.schema_fields.find(
      (f) => f.field_key === "content_status",
    );
    expect(contentStatus?.field_type).toBe("status");

    const seoBrief = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "seo-brief");
    const seoStatus = seoBrief?.metadata.schema_fields.find((f) => f.field_key === "seo_status");
    expect(seoStatus?.field_type).toBe("status");

    const socialPostBatch = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "social-post-batch");
    const batchStatus = socialPostBatch?.metadata.schema_fields.find(
      (f) => f.field_key === "batch_status",
    );
    expect(batchStatus?.field_type).toBe("status");
  });

  it("Strategy & Consulting templates ship client field and shared audit_status without colliding with essentials", () => {
    for (const slug of ["digital-maturity-audit", "general-audit", "business-plan"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
    }

    for (const slug of ["digital-maturity-audit", "general-audit"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      const client = seed?.metadata.schema_fields.find((f) => f.field_key === "client");
      expect(client, `${slug} missing client`).toBeTruthy();
      const essentialStatus = seed?.metadata.schema_fields.find((f) => f.field_key === "status");
      expect(essentialStatus?.field_type).toBe("select");
      const auditStatus = seed?.metadata.schema_fields.find((f) => f.field_key === "audit_status");
      expect(auditStatus?.field_type).toBe("status");
      expect(parseStatusOptions(auditStatus?.options)?.length).toBeGreaterThan(0);
    }

    const businessPlan = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "business-plan");
    expect(businessPlan?.metadata.schema_fields.find((f) => f.field_key === "stage")).toBeTruthy();

    const letter = SYSTEM_TEMPLATE_SEEDS.find(
      (entry) => entry.slug === "professional-business-letter",
    );
    expect(letter, "missing professional-business-letter").toBeTruthy();
    expect(letter?.metadata.schema_fields.find((f) => f.field_key === "recipient")).toBeTruthy();
  });

  it("People Operations & HR templates ship employee field and status workflows without colliding with essentials", () => {
    for (const slug of ["personal-development-plan", "performance-review"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      const employee = seed?.metadata.schema_fields.find((f) => f.field_key === "employee");
      expect(employee, `${slug} missing employee`).toBeTruthy();
      const essentialStatus = seed?.metadata.schema_fields.find((f) => f.field_key === "status");
      expect(essentialStatus?.field_type).toBe("select");
    }

    const pdp = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "personal-development-plan");
    const pdpStatus = pdp?.metadata.schema_fields.find((f) => f.field_key === "pdp_status");
    expect(pdpStatus?.field_type).toBe("status");
    expect(parseStatusOptions(pdpStatus?.options)?.length).toBeGreaterThan(0);

    const review = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "performance-review");
    const reviewStatus = review?.metadata.schema_fields.find((f) => f.field_key === "review_status");
    expect(reviewStatus?.field_type).toBe("status");
    expect(parseStatusOptions(reviewStatus?.options)?.length).toBeGreaterThan(0);

    const oneOnOne = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "one-on-one-notes");
    expect(oneOnOne, "missing one-on-one-notes").toBeTruthy();
    expect(
      oneOnOne?.metadata.schema_fields.find((f) => f.field_key === "requires_hr_followup")
        ?.field_type,
    ).toBe("checkbox");

    const jobDescription = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "job-description");
    expect(jobDescription, "missing job-description").toBeTruthy();
    expect(jobDescription?.metadata.schema_fields.find((f) => f.field_key === "seniority")).toBeTruthy();
  });

  it("Legal, Compliance & Finance templates ship jurisdiction and status workflows without colliding with essentials", () => {
    for (const slug of ["legal-document", "contract-review"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      const jurisdiction = seed?.metadata.schema_fields.find((f) => f.field_key === "jurisdiction");
      expect(jurisdiction, `${slug} missing jurisdiction`).toBeTruthy();
      const essentialStatus = seed?.metadata.schema_fields.find((f) => f.field_key === "status");
      expect(essentialStatus?.field_type).toBe("select");
    }

    const legalDocument = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "legal-document");
    const legalStatus = legalDocument?.metadata.schema_fields.find((f) => f.field_key === "legal_status");
    expect(legalStatus?.field_type).toBe("status");
    expect(parseStatusOptions(legalStatus?.options)?.length).toBeGreaterThan(0);

    const contractReview = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "contract-review");
    const reviewStatus = contractReview?.metadata.schema_fields.find(
      (f) => f.field_key === "review_status",
    );
    expect(reviewStatus?.field_type).toBe("status");
    expect(parseStatusOptions(reviewStatus?.options)?.length).toBeGreaterThan(0);

    const complianceChecklist = SYSTEM_TEMPLATE_SEEDS.find(
      (entry) => entry.slug === "compliance-checklist",
    );
    expect(complianceChecklist, "missing compliance-checklist").toBeTruthy();
    const complianceStatus = complianceChecklist?.metadata.schema_fields.find(
      (f) => f.field_key === "compliance_status",
    );
    expect(complianceStatus?.field_type).toBe("status");

    const financialReport = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "financial-report");
    expect(financialReport, "missing financial-report").toBeTruthy();
    expect(
      financialReport?.metadata.schema_fields.find((f) => f.field_key === "report_type"),
    ).toBeTruthy();
  });

  it("Academic & Scientific Research templates ship citation_style and status workflows without colliding with essentials", () => {
    for (const slug of ["research-paper", "thesis", "literature-review"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      const citationStyle = seed?.metadata.schema_fields.find((f) => f.field_key === "citation_style");
      expect(citationStyle, `${slug} missing citation_style`).toBeTruthy();
      const essentialStatus = seed?.metadata.schema_fields.find((f) => f.field_key === "status");
      expect(essentialStatus?.field_type).toBe("select");
    }

    const researchPaper = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "research-paper");
    const paperStatus = researchPaper?.metadata.schema_fields.find((f) => f.field_key === "paper_status");
    expect(paperStatus?.field_type).toBe("status");
    expect(parseStatusOptions(paperStatus?.options)?.length).toBeGreaterThan(0);

    const thesis = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "thesis");
    const thesisStatus = thesis?.metadata.schema_fields.find((f) => f.field_key === "thesis_status");
    expect(thesisStatus?.field_type).toBe("status");
    expect(thesis?.metadata.schema_fields.find((f) => f.field_key === "thesis_level")).toBeTruthy();

    const literatureReview = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "literature-review");
    const reviewStatus = literatureReview?.metadata.schema_fields.find(
      (f) => f.field_key === "review_status",
    );
    expect(reviewStatus?.field_type).toBe("status");

    const studentEssay = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "student-essay");
    expect(studentEssay, "missing student-essay").toBeTruthy();
    const essayStatus = studentEssay?.metadata.schema_fields.find((f) => f.field_key === "essay_status");
    expect(essayStatus?.field_type).toBe("status");
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

describe("resolveTemplateSchemaFieldKeys", () => {
  it("returns Meeting Notes fields (not experiment fields) by slug", () => {
    const keys = resolveTemplateSchemaFieldKeys({
      template_slug: "meeting-notes",
      document_type: "meeting_notes",
    });
    expect(keys).not.toBeNull();
    expect(keys?.has("meeting_date")).toBe(true);
    expect(keys?.has("attendees")).toBe(true);
    expect(keys?.has("status")).toBe(true);
    expect(keys?.has("experiment_status")).toBe(false);
    expect(keys?.has("confidence")).toBe(false);
  });

  it("resolves by document_type when slug is missing", () => {
    const keys = resolveTemplateSchemaFieldKeys({
      document_type: "meeting_notes",
    });
    expect(keys?.has("meeting_type")).toBe(true);
    expect(keys?.has("funnel_stage")).toBe(false);
  });

  it("returns null when classification is unknown", () => {
    expect(resolveTemplateSchemaFieldKeys({})).toBeNull();
    expect(resolveTemplateSchemaFieldKeys(null)).toBeNull();
  });
});
