import {
  resolveMindMapConfig,
  type MindMapLayout,
  type MindMapViewConfig,
  type ScopeViewInstanceRecord,
} from "@rhodes/shared/view-engine";
import type { MetadataSchemaField } from "@/lib/metadata/schemas";

export function pickMindMapInstance(
  instances: ScopeViewInstanceRecord[],
): ScopeViewInstanceRecord | null {
  return instances.find((instance) => instance.base_view_type === "mindmap") ?? null;
}

export function mindMapConfigFromInstance(
  instance: ScopeViewInstanceRecord | null,
): MindMapViewConfig {
  return resolveMindMapConfig(instance?.config);
}

export function mindMapLayout(
  instance: ScopeViewInstanceRecord | null,
): MindMapLayout {
  return instance?.layout ?? {};
}

/** Prefers config.relationField when it names a real relation schema field. */
export function resolveMindMapRelationField(
  schemas: MetadataSchemaField[],
  config?: MindMapViewConfig | null,
): MetadataSchemaField | null {
  if (config?.relationField) {
    const matched = schemas.find(
      (schema) =>
        schema.field_key === config.relationField && schema.field_type === "relation",
    );
    if (matched) return matched;
  }
  // Prefer a dedicated link field over the universal Origin property.
  return (
    schemas.find(
      (schema) =>
        schema.field_type === "relation" && schema.field_key !== "origin",
    ) ??
    schemas.find((schema) => schema.field_type === "relation") ??
    null
  );
}

/** Places a newly-added node near the layout's centroid, offset so it doesn't stack on others. */
export function nextNodePosition(layout: MindMapLayout): { x: number; y: number } {
  const points = Object.values(layout);
  if (points.length === 0) return { x: 240, y: 160 };

  const centroid = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  centroid.x /= points.length;
  centroid.y /= points.length;

  const angle = (points.length * 47) % 360;
  const radius = 160 + Math.floor(points.length / 8) * 80;
  const radians = (angle * Math.PI) / 180;

  return {
    x: Math.round(centroid.x + radius * Math.cos(radians)),
    y: Math.round(centroid.y + radius * Math.sin(radians)),
  };
}
