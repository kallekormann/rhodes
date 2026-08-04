import { readMetadataRelationValue, type MetadataSchemaField } from "@/lib/metadata/schemas";

export type GraphDocument = {
  id: string;
  title: string;
  metadata: Record<string, unknown> | null;
};

export type RelationEdge = {
  id: string;
  source: string;
  target: string;
  fieldKey: string;
  fieldLabel: string;
};

/** Relation-type schema fields, optionally restricted to an allowlist of field keys. */
export function relationFields(
  schemas: MetadataSchemaField[],
  allow?: string[],
): MetadataSchemaField[] {
  const allowed = allow && allow.length > 0 ? new Set(allow) : null;
  return schemas.filter(
    (schema) => schema.field_type === "relation" && (!allowed || allowed.has(schema.field_key)),
  );
}

/** Derives directed edges from every relation field value across the given documents. */
export function buildRelationEdges<T extends GraphDocument>(
  documents: T[],
  fields: MetadataSchemaField[],
): RelationEdge[] {
  const docIds = new Set(documents.map((doc) => doc.id));
  const edges: RelationEdge[] = [];

  for (const doc of documents) {
    for (const field of fields) {
      const value = readMetadataRelationValue(doc.metadata, field.field_key);
      if (value?.document_id && value.document_id !== doc.id && docIds.has(value.document_id)) {
        edges.push({
          id: `${doc.id}->${value.document_id}:${field.field_key}`,
          source: doc.id,
          target: value.document_id,
          fieldKey: field.field_key,
          fieldLabel: field.field_label,
        });
      }
    }
  }

  return edges;
}

/** Undirected connection count per document — Knowledge Graph node sizing ("hub" documents). */
export function computeDegrees<T extends GraphDocument>(
  documents: T[],
  edges: RelationEdge[],
): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const doc of documents) degrees.set(doc.id, 0);
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return degrees;
}

/**
 * Synchronous label propagation community detection — deterministic given a stable input
 * order, O(nodes * edges * iterations). Good enough for scope-sized graphs (hundreds of docs);
 * revisit with a real Louvain/Leiden implementation if quality issues surface.
 */
export function detectCommunities<T extends GraphDocument>(
  documents: T[],
  edges: RelationEdge[],
  maxIterations = 20,
): Map<string, number> {
  const neighbors = new Map<string, string[]>();
  for (const doc of documents) neighbors.set(doc.id, []);
  for (const edge of edges) {
    neighbors.get(edge.source)?.push(edge.target);
    neighbors.get(edge.target)?.push(edge.source);
  }

  const labels = new Map<string, string>();
  for (const doc of documents) labels.set(doc.id, doc.id);

  const order = documents.map((doc) => doc.id);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;

    for (const id of order) {
      const neighborIds = neighbors.get(id) ?? [];
      if (neighborIds.length === 0) continue;

      const counts = new Map<string, number>();
      for (const neighborId of neighborIds) {
        const label = labels.get(neighborId);
        if (!label) continue;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }

      let bestLabel = labels.get(id) ?? id;
      let bestCount = -1;
      for (const [label, count] of counts) {
        if (count > bestCount || (count === bestCount && label < bestLabel)) {
          bestCount = count;
          bestLabel = label;
        }
      }

      if (bestLabel !== labels.get(id)) {
        labels.set(id, bestLabel);
        changed = true;
      }
    }

    if (!changed) break;
  }

  const groups = new Map<string, string[]>();
  for (const [id, label] of labels) {
    const group = groups.get(label) ?? [];
    group.push(id);
    groups.set(label, group);
  }

  const sortedLabels = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label]) => label);
  const communityIndex = new Map(sortedLabels.map((label, index) => [label, index]));

  const result = new Map<string, number>();
  for (const [id, label] of labels) {
    result.set(id, communityIndex.get(label) ?? 0);
  }
  return result;
}
