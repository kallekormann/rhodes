/** Recommended templates and minimum counts per additional scope view type. */
export type ViewTemplateAffinity = {
  recommended: string[];
  /** How many templates supporting this view must be selected to infer the view. */
  minForView: number;
};

export type ViewTemplateAffinityMap = Record<string, ViewTemplateAffinity>;

/**
 * View ↔ template affinity graph.
 * Bundles layer on top; individual view/template picks use this for bidirectional inference.
 */
export const VIEW_TEMPLATE_AFFINITY: ViewTemplateAffinityMap = {
  kanban: {
    recommended: [
      "project-kickoff",
      "sprint-retro",
      "meeting-notes",
      "ab-experiment",
      "insight",
      "problem",
      "adr",
      "technical-requirements-document",
      "workflow-definition",
    ],
    minForView: 1,
  },
  calendar: {
    recommended: ["editorial-calendar", "meeting-notes", "report"],
    minForView: 1,
  },
  gantt: {
    recommended: ["project-charter", "product-spec", "report", "ab-experiment", "scientific-experiment"],
    minForView: 1,
  },
  wiki: {
    recommended: [
      "sop",
      "onboarding-guide",
      "policy-document",
      "blank",
      "insight",
      "problem",
      "scientific-experiment",
      "adr",
      "technical-requirements-document",
      "workflow-definition",
    ],
    minForView: 1,
  },
  dashboard: {
    recommended: ["weekly-status", "report", "product-spec", "ab-experiment"],
    minForView: 1,
  },
};

/** System template slugs and which additional views they support (M2.5.0 seeds). */
export const TEMPLATE_SUPPORTED_VIEWS: Record<string, string[]> = {
  blank: ["wiki", "kanban", "calendar", "gantt", "dashboard"],
  "meeting-notes": ["calendar", "kanban"],
  report: ["dashboard", "calendar", "gantt"],
  "product-spec": ["kanban", "gantt", "dashboard"],
  sop: ["wiki", "dashboard"],
  "onboarding-guide": ["wiki", "calendar"],
  "policy-document": ["wiki", "dashboard"],
  "ab-experiment": ["kanban", "dashboard", "gantt"],
  insight: ["kanban", "wiki"],
  problem: ["kanban", "wiki"],
  "scientific-experiment": ["kanban", "gantt", "wiki"],
  adr: ["wiki", "kanban"],
  "technical-requirements-document": ["wiki", "kanban"],
  "workflow-definition": ["wiki", "kanban"],
};

export function getRecommendedTemplatesForView(viewId: string): string[] {
  return VIEW_TEMPLATE_AFFINITY[viewId]?.recommended ?? [];
}

export function getViewsSupportedByTemplate(slug: string): string[] {
  return TEMPLATE_SUPPORTED_VIEWS[slug] ?? [];
}

export function countTemplatesSupportingView(
  templateSlugs: Iterable<string>,
  viewId: string,
): number {
  let count = 0;
  for (const slug of templateSlugs) {
    if (getViewsSupportedByTemplate(slug).includes(viewId)) count += 1;
  }
  return count;
}

export function viewsSatisfiedByTemplates(
  templateSlugs: Iterable<string>,
  affinity: ViewTemplateAffinityMap = VIEW_TEMPLATE_AFFINITY,
): string[] {
  const slugs = [...templateSlugs];
  const satisfied: string[] = [];
  for (const [viewId, rule] of Object.entries(affinity)) {
    const count = countTemplatesSupportingView(slugs, viewId);
    if (count >= rule.minForView) satisfied.push(viewId);
  }
  return satisfied;
}
