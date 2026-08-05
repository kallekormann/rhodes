import { describe, expect, it } from "vitest";
import {
  ESSENTIAL_TEMPLATE_FIELD_KEYS,
  SYSTEM_TEMPLATE_SEEDS,
  TEMPLATE_CATEGORY_CATALOG,
  resolveTemplateSchemaFieldKeys,
  resolveTemplateSchemaGroupKeys,
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
      "ticket",
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

      const statusKey =
        slug === "ab-experiment" ? "ab_experiment_status" : "science_experiment_status";
      const experimentStatus = seed?.metadata.schema_fields.find(
        (f) => f.field_key === statusKey,
      );
      expect(experimentStatus, `${slug} missing ${statusKey}`).toBeTruthy();
      expect(experimentStatus?.field_type).toBe("status");
      expect(parseStatusOptions(experimentStatus?.options)?.length).toBeGreaterThan(0);
    }

    // A/B uses Experiment status as the sole lifecycle (Kanban groups by it).
    const abExperiment = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "ab-experiment");
    expect(abExperiment?.metadata.schema_fields.find((f) => f.field_key === "status")).toBeUndefined();
    expect(
      abExperiment?.metadata.schema_fields.find((f) => f.field_key === "origin")?.field_type,
    ).toBe("relation");

    // Scientific experiment still keeps essential status + science_experiment_status.
    const scientific = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "scientific-experiment");
    expect(scientific?.metadata.schema_fields.find((f) => f.field_key === "status")?.field_type).toBe(
      "select",
    );
  });

  it("Product Architecture templates ship impact_area and their own status keys without colliding with essentials", () => {
    for (const slug of ["adr", "technical-requirements-document"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      const impactArea = seed?.metadata.schema_fields.find((f) => f.field_key === "impact_area");
      expect(impactArea, `${slug} missing impact_area`).toBeTruthy();
      expect(impactArea?.field_type).toBe("tags");
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
      expect(client?.field_type).toBe("relation");
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
      expect(employee?.field_type).toBe("relation");
      const manager = seed?.metadata.schema_fields.find((f) => f.field_key === "manager");
      expect(manager?.field_type).toBe("relation");
      const essentialStatus = seed?.metadata.schema_fields.find((f) => f.field_key === "status");
      expect(essentialStatus?.field_type).toBe("select");
    }

    const pdp = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "personal-development-plan");
    const pdpStatus = pdp?.metadata.schema_fields.find((f) => f.field_key === "pdp_status");
    expect(pdpStatus?.field_type).toBe("status");
    expect(parseStatusOptions(pdpStatus?.options)?.length).toBeGreaterThan(0);

    const review = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "performance-review");
    const reviewStatus = review?.metadata.schema_fields.find(
      (f) => f.field_key === "performance_review_status",
    );
    expect(reviewStatus?.field_type).toBe("status");
    expect(parseStatusOptions(reviewStatus?.options)?.length).toBeGreaterThan(0);
    expect(review?.metadata.schema_fields.find((f) => f.field_key === "rating")?.options).toEqual(
      expect.arrayContaining(["exceeds_expectations", "meets_expectations", "needs_development"]),
    );

    const oneOnOne = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "one-on-one-notes");
    expect(oneOnOne, "missing one-on-one-notes").toBeTruthy();
    expect(
      oneOnOne?.metadata.schema_fields.find((f) => f.field_key === "requires_hr_followup")
        ?.field_type,
    ).toBe("checkbox");
    expect(oneOnOne?.metadata.schema_fields.find((f) => f.field_key === "participant")?.field_type).toBe(
      "relation",
    );
    expect(oneOnOne?.metadata.schema_fields.find((f) => f.field_key === "visibility")).toBeTruthy();

    const jobDescription = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "job-description");
    expect(jobDescription, "missing job-description").toBeTruthy();
    expect(jobDescription?.metadata.schema_fields.find((f) => f.field_key === "seniority")).toBeTruthy();
    expect(jobDescription?.metadata.schema_fields.find((f) => f.field_key === "department")?.field_type).toBe(
      "tags",
    );
  });

  it("People, legal, academic templates and Ticket incorporate reviewer feedback", () => {
    const letter = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "professional-business-letter")!;
    expect(letter.metadata.schema_fields.find((f) => f.field_key === "subject_line")).toBeTruthy();
    expect(letter.metadata.schema_fields.find((f) => f.field_key === "recipient")?.field_type).toBe(
      "relation",
    );

    const legal = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "legal-document")!;
    const legalHeadings = (
      legal.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(legalHeadings).toContain("Term, Termination & Renewal");
    expect(legal.metadata.schema_fields.find((f) => f.field_key === "jurisdiction")?.field_type).toBe(
      "tags",
    );
    expect(legal.metadata.schema_fields.find((f) => f.field_key === "counterparty")?.field_type).toBe(
      "relation",
    );

    const paper = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "research-paper")!;
    const paperHeadings = (
      paper.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(paperHeadings).toContain("Related Work & Literature Review");

    const thesis = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "thesis")!;
    expect(thesis.metadata.schema_fields.find((f) => f.field_key === "advisor")?.field_type).toBe(
      "relation",
    );
    const thesisHeadings = (
      thesis.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(thesisHeadings).toContain("Defense Notes & Q&A Prep");

    const lit = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "literature-review")!;
    expect(lit.metadata.schema_fields.find((f) => f.field_key === "research_area")?.field_type).toBe(
      "tags",
    );

    const compliance = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "compliance-checklist")!;
    expect(compliance.metadata.schema_fields.find((f) => f.field_key === "related_audit")?.field_type).toBe(
      "relation",
    );

    const ticket = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "ticket")!;
    expect(ticket.metadata.category).toBe("essentials");
    expect(ticket.metadata.supported_views).toContain("kanban");
    expect(ticket.metadata.schema_fields.find((f) => f.field_key === "ticket_type")).toBeTruthy();
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
      (f) => f.field_key === "contract_review_status",
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
      (f) => f.field_key === "literature_review_status",
    );
    expect(reviewStatus?.field_type).toBe("status");

    const studentEssay = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "student-essay");
    expect(studentEssay, "missing student-essay").toBeTruthy();
    const essayStatus = studentEssay?.metadata.schema_fields.find((f) => f.field_key === "essay_status");
    expect(essayStatus?.field_type).toBe("status");
  });

  it("assigns every system template to one of five browse categories", () => {
    const allowed = new Set(TEMPLATE_CATEGORY_CATALOG.map((entry) => entry.id));
    const counts = Object.fromEntries(
      TEMPLATE_CATEGORY_CATALOG.map((entry) => [entry.id, 0]),
    ) as Record<string, number>;

    for (const seed of SYSTEM_TEMPLATE_SEEDS) {
      expect(allowed.has(seed.metadata.category), `${seed.slug} bad category`).toBe(
        true,
      );
      counts[seed.metadata.category] += 1;
    }

    expect(Object.values(counts).every((n) => n > 0)).toBe(true);
    expect(TEMPLATE_CATEGORY_CATALOG).toHaveLength(5);
  });

  it("ships essentials with field_type and AI fill", () => {
    for (const seed of SYSTEM_TEMPLATE_SEEDS) {
      for (const key of ESSENTIAL_TEMPLATE_FIELD_KEYS) {
        const field = seed.metadata.schema_fields.find((f) => f.field_key === key);
        // Timeline templates omit due_date in favor of domain date fields.
        if (
          (seed.slug === "ab-experiment" || seed.slug === "project-charter") &&
          key === "due_date"
        ) {
          expect(field, `${seed.slug} should omit due_date`).toBeUndefined();
          continue;
        }
        // A/B uses ab_experiment_status as the sole lifecycle — omit generic status.
        if (seed.slug === "ab-experiment" && key === "status") {
          expect(field, "ab-experiment should omit status").toBeUndefined();
          continue;
        }
        expect(field, `${seed.slug} missing ${key}`).toBeTruthy();
        if (key === "origin") {
          expect(field?.ai_fill_enabled).toBe(false);
        } else {
          expect(field?.ai_fill_enabled).toBe(true);
        }
        expect(field?.field_type).toBeTruthy();
      }
      expect(seed.metadata.document_type).toBeTruthy();
      expect(
        seed.metadata.schema_fields.some((f) => f.field_key === "document_type"),
      ).toBe(false);
    }
  });

  it("Content and strategy templates incorporate reviewer feedback", () => {
    const editorial = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "editorial-calendar")!;
    expect(editorial.metadata.schema_fields.find((f) => f.field_key === "funnel_stage")).toBeTruthy();
    const editorialHeadings = (
      editorial.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(editorialHeadings).toContain("Draft / Content");

    const seo = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "seo-brief")!;
    expect(seo.metadata.schema_fields.find((f) => f.field_key === "search_volume")).toBeTruthy();
    expect(seo.metadata.schema_fields.find((f) => f.field_key === "keyword_difficulty")).toBeTruthy();
    const seoHeadings = (
      seo.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(seoHeadings).toContain("Angle & SERP Strategy");
    expect(seoHeadings).not.toContain("Target Keyword & Search Intent");

    const social = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "social-post-batch")!;
    const batchStatus = social.metadata.schema_fields.find((f) => f.field_key === "batch_status");
    const batchValues = (batchStatus?.options as Array<{ value: string }> | undefined)?.map(
      (o) => o.value,
    );
    expect(batchValues).toEqual(
      expect.arrayContaining(["in_review", "approved", "scheduled", "published"]),
    );

    const general = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "general-audit")!;
    const generalHeadings = (
      general.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(generalHeadings?.[0]).toBe("Executive Summary");

    const plan = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "business-plan")!;
    expect(plan.metadata.schema_groups?.some((g) => g.group_key === "funding")).toBe(true);
    expect(plan.metadata.schema_groups?.some((g) => g.group_key === "arr")).toBe(true);
    const planHeadings = (
      plan.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(planHeadings).toContain("Go-To-Market & Distribution");
  });

  it("GTM, Status Report, and Campaign Brief incorporate reviewer feedback", () => {
    const gtm = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "gtm-plan")!;
    expect(gtm.metadata.schema_fields.find((f) => f.field_key === "gtm_tier")).toBeTruthy();
    const gtmHeadings = (
      gtm.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(gtmHeadings).toContain("Internal Enablement");
    expect(gtmHeadings).not.toContain("Enablement & Proof");

    const status = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "weekly-status")!;
    const statusHeadings = (
      status.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(statusHeadings).not.toContain("Summary");
    expect(status.metadata.schema_fields.find((f) => f.field_key === "period_end")?.field_type).toBe(
      "date",
    );

    const campaign = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "campaign-brief")!;
    const campaignBody = JSON.stringify(campaign.structure_json);
    expect(campaignBody).toContain("CTA");
    expect(campaignBody.toLowerCase()).toContain("figma");
  });

  it("PRD, Product Feature, and Product Spec descriptions draw a clear triad", () => {
    const prd = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "prd")!;
    const feature = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "product-feature")!;
    const spec = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "product-spec")!;
    expect(prd.description.toLowerCase()).toMatch(/epic|moscow|delivery/);
    expect(spec.description.toLowerCase()).toMatch(/hypothesis|growth/);
    expect(feature.description.toLowerCase()).toMatch(/tactical|one-pager|bounded/);

    const prdHeadings = (
      prd.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(prdHeadings).toContain("Success Metrics & KPIs");

    const swot = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "swot-analysis")!;
    expect(swot.metadata.schema_fields.find((f) => f.field_key === "valid_until")).toBeTruthy();
    expect(swot.metadata.schema_fields.find((f) => f.field_key === "competitor_name")).toBeTruthy();
    const swotHeadings = (
      swot.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(swotHeadings).toContain("Strategic Implications / Action Items");

    const charter = SYSTEM_TEMPLATE_SEEDS.find((s) => s.slug === "project-charter")!;
    expect(
      charter.metadata.schema_fields.find((f) => f.field_key === "project_timeframe"),
    ).toBeTruthy();
    expect(charter.metadata.schema_fields.find((f) => f.field_key === "due_date")).toBeUndefined();
    const charterHeadings = (
      charter.structure_json.content as Array<Record<string, unknown>>
    )
      .filter((n) => n.type === "heading")
      .map((n) => (n.content as Array<{ text?: string }>)?.[0]?.text);
    expect(charterHeadings).toContain("Key Risks & Constraints");
  });

  it("A/B Experiment ships research-backed fields, groups, and body sections", () => {
    const ab = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === "ab-experiment");
    expect(ab).toBeTruthy();

    const keys = new Set(ab!.metadata.schema_fields.map((f) => f.field_key));
    for (const key of [
      "ab_experiment_status",
      "launch_date",
      "planned_duration_days",
      "traffic_split",
      "funnel_stage",
      "growth_loop",
      "psychological_layer",
      "experiment_result",
      "experiment_decision",
      "erosion_risk",
      "origin",
    ]) {
      expect(keys.has(key), `ab-experiment missing ${key}`).toBe(true);
    }
    expect(keys.has("due_date")).toBe(false);
    expect(keys.has("status")).toBe(false);
    expect(keys.has("date_active")).toBe(false);
    expect(keys.has("target_segment")).toBe(false);
    expect(keys.has("impact")).toBe(false);
    expect(keys.has("mde")).toBe(false);
    expect(keys.has("sample_size")).toBe(false);
    expect(keys.has("primary_kpi_label")).toBe(false);

    const duration = ab!.metadata.schema_fields.find(
      (f) => f.field_key === "planned_duration_days",
    );
    expect(duration?.field_label).toBe("Planned duration");
    expect(duration?.options).toEqual({ unit: "days" });
    expect(duration?.ai_fill_enabled).toBe(true);

    const groupKeys = new Set((ab!.metadata.schema_groups ?? []).map((g) => g.group_key));
    for (const key of [
      "targeting_experiment",
      "ice",
      "primary_kpi",
      "secondary_kpi",
      "guardrail_kpi",
      "power",
      "primary_kpi_result",
      "secondary_kpi_result",
      "guardrail_kpi_result",
    ]) {
      expect(groupKeys.has(key), `ab-experiment missing group ${key}`).toBe(true);
    }
    const targeting = ab!.metadata.schema_groups?.find(
      (g) => g.group_key === "targeting_experiment",
    );
    expect(targeting?.fields.map((f) => f.sub_key).sort()).toEqual(
      ["audience", "country", "market", "product", "surface"].sort(),
    );
    const primaryKpi = ab!.metadata.schema_groups?.find((g) => g.group_key === "primary_kpi");
    expect(primaryKpi?.fields.map((f) => f.sub_key)).toEqual(["label", "baseline", "lift_pct"]);
    expect(primaryKpi?.fields.find((f) => f.sub_key === "lift_pct")?.options).toEqual({
      unit: "%",
    });
    const power = ab!.metadata.schema_groups?.find((g) => g.group_key === "power");
    expect(power?.fields.map((f) => f.sub_key).sort()).toEqual(
      ["mde", "sample_size", "traffic_per_day"].sort(),
    );

    const content = ab!.structure_json.content as Array<Record<string, unknown>>;
    const headings = content
      .filter((node) => node.type === "heading")
      .map((node) => {
        const children = node.content as Array<{ text?: string }> | undefined;
        return children?.[0]?.text ?? "";
      });
    expect(headings).toEqual([
      "Problem / Insight",
      "Problem Statement",
      "How Might We",
      "Hypothesis",
      "Rationale",
      "Falsification",
      "Decision Rule",
      "Sample Size & MDE",
      "Variants",
      "Risks & Dependencies",
      "Results: Insight, Learning & Decision",
    ]);

    const variantTip = content.find(
      (node, i) =>
        node.type === "paragraph" &&
        headings.indexOf("Variants") >= 0 &&
        content[i - 1]?.type === "heading" &&
        (content[i - 1] as { content?: Array<{ text?: string }> }).content?.[0]?.text ===
          "Variants",
    );
    const tipText =
      (variantTip?.content as Array<{ text?: string; marks?: unknown[] }> | undefined)
        ?.map((t) => t.text)
        .join("") ?? "";
    expect(tipText.toLowerCase()).toContain("change hypothesis");
  });

  it("GTM and content templates ship Targeting group subfields", () => {
    const expectations: Record<string, { groupKey: string; subs: string[] }> = {
      "user-flow-definition": {
        groupKey: "targeting_flow",
        subs: ["product", "market", "audience", "surface"],
      },
      "gtm-plan": { groupKey: "targeting_gtm", subs: ["market", "audience"] },
      "launch-checklist": { groupKey: "targeting_launch", subs: ["product", "market"] },
      "campaign-brief": {
        groupKey: "targeting_content",
        subs: ["channel", "market", "audience"],
      },
      "editorial-calendar": {
        groupKey: "targeting_content",
        subs: ["market", "audience", "channel"],
      },
      "seo-brief": {
        groupKey: "targeting_content",
        subs: ["market", "audience", "channel"],
      },
      "social-post-batch": {
        groupKey: "targeting_content",
        subs: ["market", "audience", "channel"],
      },
    };
    for (const [slug, { groupKey, subs }] of Object.entries(expectations)) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      const targeting = seed!.metadata.schema_groups?.find((g) => g.group_key === groupKey);
      expect(targeting, `${slug} missing ${groupKey} group`).toBeTruthy();
      expect(targeting!.fields.map((f) => f.sub_key).sort()).toEqual([...subs].sort());
    }
  });

  it("Growth and product discovery tips point users at Origin", () => {
    for (const slug of ["insight", "problem", "product-spec", "prd", "product-feature"]) {
      const seed = SYSTEM_TEMPLATE_SEEDS.find((entry) => entry.slug === slug);
      expect(seed, `missing ${slug}`).toBeTruthy();
      const content = JSON.stringify(seed!.structure_json);
      expect(content).toContain("Properties → Origin");
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
    expect(keys?.has("ab_experiment_status")).toBe(false);
    expect(keys?.has("confidence")).toBe(false);
  });

  it("returns A/B Experiment fields (not meeting fields) by slug", () => {
    const keys = resolveTemplateSchemaFieldKeys({
      template_slug: "ab-experiment",
      document_type: "ab_experiment",
    });
    expect(keys).not.toBeNull();
    expect(keys?.has("ab_experiment_status")).toBe(true);
    expect(keys?.has("launch_date")).toBe(true);
    expect(keys?.has("planned_duration_days")).toBe(true);
    expect(keys?.has("status")).toBe(false);
    expect(keys?.has("due_date")).toBe(false);
    expect(keys?.has("date_active")).toBe(false);
    expect(keys?.has("mde")).toBe(false);
    expect(keys?.has("meeting_date")).toBe(false);
    expect(keys?.has("attendees")).toBe(false);

    const groups = resolveTemplateSchemaGroupKeys({
      template_slug: "ab-experiment",
      document_type: "ab_experiment",
    });
    expect(groups?.has("power")).toBe(true);
    expect(groups?.has("guardrail_kpi_result")).toBe(true);
    expect(groups?.has("targeting_experiment")).toBe(true);
    expect(groups?.has("targeting")).toBe(false);
    expect(groups?.has("ice")).toBe(true);
    expect(groups?.has("primary_kpi")).toBe(true);
  });

  it("returns empty group set for templates without schema_groups", () => {
    const groups = resolveTemplateSchemaGroupKeys({
      template_slug: "meeting-notes",
    });
    expect(groups).not.toBeNull();
    expect(groups?.size).toBe(0);
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
