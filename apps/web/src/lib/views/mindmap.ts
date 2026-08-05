import {
  createEmptyMindMapLayout,
  normalizeMindMapLayout,
  resolveMindMapConfig,
  type MindMapLayout,
  type MindMapNodeLayout,
  type MindMapSide,
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
  return normalizeMindMapLayout(instance?.layout ?? null);
}

export function isMindMapPlaceholder(
  node: MindMapNodeLayout | undefined,
): boolean {
  return !node?.documentId;
}

export function mindMapNeedsGuidedSetup(layout: MindMapLayout): boolean {
  const root = layout.nodes[layout.rootId];
  return Boolean(root && !root.documentId);
}

export function createLocalMindMapNodeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local:${crypto.randomUUID()}`;
  }
  return `local:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  return (
    schemas.find(
      (schema) =>
        schema.field_type === "relation" && schema.field_key !== "origin",
    ) ??
    schemas.find((schema) => schema.field_type === "relation") ??
    null
  );
}

export function collectSubtreeNodeIds(
  layout: MindMapLayout,
  nodeId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const [id, node] of Object.entries(layout.nodes)) {
    if (!node.parentId) continue;
    const list = childrenByParent.get(node.parentId) ?? [];
    list.push(id);
    childrenByParent.set(node.parentId, list);
  }

  const collected: string[] = [];
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    collected.push(current);
    const kids = childrenByParent.get(current) ?? [];
    for (const kid of kids) stack.push(kid);
  }
  return collected;
}

export function removeMindMapNodes(
  layout: MindMapLayout,
  nodeIds: Iterable<string>,
): MindMapLayout {
  const remove = new Set(nodeIds);
  if (remove.has(layout.rootId)) {
    return createEmptyMindMapLayout();
  }
  const nodes: Record<string, MindMapNodeLayout> = {};
  for (const [id, node] of Object.entries(layout.nodes)) {
    if (remove.has(id)) continue;
    nodes[id] = node;
  }
  return { ...layout, nodes };
}

/**
 * Branch side for a node: walk up to the direct root child.
 * Defaults to "right" when unset.
 */
export function resolveMindMapNodeSide(
  layout: MindMapLayout,
  nodeId: string,
): MindMapSide {
  if (nodeId === layout.rootId) return "right";
  let current: string | null = nodeId;
  while (current) {
    const node: MindMapNodeLayout | undefined = layout.nodes[current];
    if (!node) return "right";
    if (node.parentId === layout.rootId) {
      return node.side === "left" ? "left" : "right";
    }
    if (!node.parentId) return "right";
    current = node.parentId;
  }
  return "right";
}

/** Pick the less-crowded root side for a new direct child of the root. */
export function pickMindMapRootSide(layout: MindMapLayout): MindMapSide {
  let left = 0;
  let right = 0;
  for (const node of Object.values(layout.nodes)) {
    if (node.parentId !== layout.rootId) continue;
    if (node.side === "left") left += 1;
    else right += 1;
  }
  return left < right ? "left" : "right";
}

function applySideToSubtree(
  layout: MindMapLayout,
  nodeId: string,
  side: MindMapSide,
): MindMapLayout {
  const subtree = collectSubtreeNodeIds(layout, nodeId);
  const nodes = { ...layout.nodes };
  for (const id of subtree) {
    const existing = nodes[id];
    if (!existing) continue;
    nodes[id] = { ...existing, side };
  }
  return { ...layout, nodes };
}

export function bindDocumentToMindMapNode(
  layout: MindMapLayout,
  nodeId: string,
  documentId: string,
): MindMapLayout {
  const existing = layout.nodes[nodeId];
  if (!existing) return layout;

  // Already keyed by document id — just attach.
  if (nodeId === documentId) {
    return {
      ...layout,
      nodes: {
        ...layout.nodes,
        [nodeId]: { ...existing, documentId },
      },
    };
  }

  // Replace placeholder local ids with the real document id so we don't keep
  // a ghost "Central topic" node alongside the created document.
  const nodes: Record<string, MindMapNodeLayout> = {};
  for (const [id, node] of Object.entries(layout.nodes)) {
    if (id === nodeId) continue;
    nodes[id] =
      node.parentId === nodeId
        ? { ...node, parentId: documentId }
        : node;
  }
  nodes[documentId] = {
    ...existing,
    documentId,
    parentId:
      existing.parentId === nodeId || existing.parentId === documentId
        ? null
        : existing.parentId,
    side: existing.parentId == null ? null : existing.side ?? "right",
  };

  return {
    ...layout,
    rootId: layout.rootId === nodeId ? documentId : layout.rootId,
    nodes,
  };
}

export function addMindMapChildNode(
  layout: MindMapLayout,
  parentId: string,
  documentId: string,
  position: { x: number; y: number },
  nodeId = documentId,
  side?: MindMapSide,
): MindMapLayout {
  const resolvedSide: MindMapSide =
    side ??
    (parentId === layout.rootId
      ? pickMindMapRootSide(layout)
      : resolveMindMapNodeSide(layout, parentId));

  return {
    ...layout,
    nodes: {
      ...layout.nodes,
      [nodeId]: {
        x: position.x,
        y: position.y,
        parentId,
        documentId,
        side: resolvedSide,
      },
    },
  };
}

export function reparentMindMapNode(
  layout: MindMapLayout,
  nodeId: string,
  newParentId: string | null,
  side?: MindMapSide | null,
): MindMapLayout {
  if (nodeId === layout.rootId) return layout;
  const existing = layout.nodes[nodeId];
  if (!existing) return layout;
  if (newParentId && !layout.nodes[newParentId]) return layout;
  // Prevent cycles: new parent must not be in this node's subtree.
  if (newParentId && collectSubtreeNodeIds(layout, nodeId).includes(newParentId)) {
    return layout;
  }

  let nextSide: MindMapSide | null = null;
  if (newParentId == null) {
    nextSide = null;
  } else if (newParentId === layout.rootId) {
    nextSide =
      side === "left" || side === "right"
        ? side
        : existing.side === "left" || existing.side === "right"
          ? existing.side
          : pickMindMapRootSide(layout);
  } else {
    nextSide = resolveMindMapNodeSide(layout, newParentId);
  }

  const withParent: MindMapLayout = {
    ...layout,
    nodes: {
      ...layout.nodes,
      [nodeId]: {
        ...existing,
        parentId: newParentId,
        side: nextSide,
      },
    },
  };

  // Moving a branch across the root (or under another branch) carries the
  // whole subtree so children stay with their parent.
  if (nextSide === "left" || nextSide === "right") {
    return applySideToSubtree(withParent, nodeId, nextSide);
  }
  return withParent;
}

export type MindMapReparentEndpoints = {
  childId: string;
  parentId: string;
};

/**
 * Resolve parent/child for a new React Flow connection.
 *
 * Mind-map edges are stored parent→child, but users often drag from the node
 * they want to *move* onto its new parent. Blindly treating `source` as parent
 * inverted that gesture (the moved node became mother of the drop target).
 */
export function resolveMindMapReparentFromConnect(
  layout: MindMapLayout,
  sourceId: string,
  targetId: string,
): MindMapReparentEndpoints | null {
  if (!sourceId || !targetId || sourceId === targetId) return null;
  if (!layout.nodes[sourceId] || !layout.nodes[targetId]) return null;

  if (sourceId === layout.rootId) {
    return { parentId: sourceId, childId: targetId };
  }
  if (targetId === layout.rootId) {
    return { parentId: targetId, childId: sourceId };
  }

  // Existing ancestry wins: keep the higher node as parent.
  if (collectSubtreeNodeIds(layout, sourceId).includes(targetId)) {
    return { parentId: sourceId, childId: targetId };
  }
  if (collectSubtreeNodeIds(layout, targetId).includes(sourceId)) {
    return { parentId: targetId, childId: sourceId };
  }

  // Default gesture: drag-from = child to move, drop-on = new parent.
  return { parentId: targetId, childId: sourceId };
}

/**
 * Resolve parent/child when reconnecting an existing parent→child edge.
 * The original edge target is always the child being moved.
 */
export function resolveMindMapReparentFromReconnect(
  layout: MindMapLayout,
  oldEdge: { source: string; target: string },
  next: { source: string | null; target: string | null },
): MindMapReparentEndpoints | null {
  const childId = oldEdge.target;
  if (!childId || !layout.nodes[childId] || childId === layout.rootId) {
    return null;
  }

  const a = next.source;
  const b = next.target;
  if (!a || !b) return null;

  let parentId: string | null = null;
  if (a === childId && b !== childId) {
    parentId = b;
  } else if (b === childId && a !== childId) {
    parentId = a;
  } else if (a !== childId && b !== childId) {
    // Child end was dragged onto a new node; prefer the endpoint that isn't
    // the previous parent.
    parentId = a !== oldEdge.source ? a : b !== oldEdge.source ? b : a;
  }

  if (!parentId || parentId === childId || !layout.nodes[parentId]) {
    return null;
  }

  return { parentId, childId };
}

export { createEmptyMindMapLayout, normalizeMindMapLayout };
