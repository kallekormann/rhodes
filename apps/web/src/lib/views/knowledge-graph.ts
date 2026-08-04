import {
  resolveKnowledgeGraphConfig,
  type KnowledgeGraphViewConfig,
  type ScopeViewInstanceRecord,
} from "@rhodes/shared/view-engine";

export function pickKnowledgeGraphInstance(
  instances: ScopeViewInstanceRecord[],
): ScopeViewInstanceRecord | null {
  return instances.find((instance) => instance.base_view_type === "graph") ?? null;
}

export function knowledgeGraphConfigFromInstance(
  instance: ScopeViewInstanceRecord | null,
): KnowledgeGraphViewConfig {
  return resolveKnowledgeGraphConfig(instance?.config);
}

/** Community detection + legend default on, per the v1 requirement (not a fast-follow). */
export function showCommunitiesEnabled(config: KnowledgeGraphViewConfig): boolean {
  return config.showCommunities !== false;
}

/** Normalizes a raw connection count into a 0–1 emphasis value for node sizing. */
export function degreeEmphasis(degree: number, maxDegree: number): number {
  if (maxDegree <= 0) return 0;
  return Math.min(1, degree / maxDegree);
}
