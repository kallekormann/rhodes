import {
  normalizeWikiLayout,
  type WikiLayout,
} from "@rhodes/shared/view-engine";
import { readMetadataRelationValue } from "@/lib/metadata/schemas";

export type WikiDocument = {
  id: string;
  title: string;
  metadata: Record<string, unknown> | null;
};

export type WikiTreeNode = {
  id: string;
  title: string;
  children: WikiTreeNode[];
};

export type WikiDropKind = "reorder" | "reparent";

export type WikiDropResult =
  | {
      kind: "reorder";
      parentId: string;
      orderedChildIds: string[];
    }
  | {
      kind: "reparent";
      childId: string;
      newParentId: string;
      previousParentId: string | null;
      /** When set, place the child among the new parent's siblings at this order. */
      orderedChildIds?: string[];
    }
  | { kind: "invalid"; reason: string };

/** Parent document id from Origin (or configured relation), or null. */
export function wikiParentId(
  doc: WikiDocument,
  relationField = "origin",
): string | null {
  const value = readMetadataRelationValue(doc.metadata, relationField);
  return value?.document_id ?? null;
}

/** True if `candidateAncestorId` is `nodeId` or an ancestor of it in the parent map. */
export function wouldCreateCycle(
  parentByChild: Map<string, string | null>,
  nodeId: string,
  candidateAncestorId: string,
): boolean {
  if (nodeId === candidateAncestorId) return true;
  let current: string | null | undefined = candidateAncestorId;
  const seen = new Set<string>();
  while (current) {
    if (current === nodeId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = parentByChild.get(current) ?? null;
  }
  return false;
}

function sortChildren(
  childIds: string[],
  order: string[] | undefined,
): string[] {
  if (!order || order.length === 0) return childIds;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...childIds].sort((a, b) => {
    const ra = rank.has(a) ? (rank.get(a) as number) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b) ? (rank.get(b) as number) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

/**
 * Build a forest under `rootDocumentId` from Origin (or relationField) links.
 * Documents outside the root's descendant set are omitted.
 */
export function buildWikiTree(
  documents: WikiDocument[],
  rootDocumentId: string,
  layout: WikiLayout | unknown,
  relationField = "origin",
): WikiTreeNode | null {
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  if (!byId.has(rootDocumentId)) return null;

  const normalized = normalizeWikiLayout(layout);
  const parentByChild = new Map<string, string | null>();
  const childrenByParent = new Map<string, string[]>();

  for (const doc of documents) {
    if (doc.id === rootDocumentId) {
      parentByChild.set(doc.id, null);
      continue;
    }
    const parentId = wikiParentId(doc, relationField);
    if (!parentId || !byId.has(parentId) || parentId === doc.id) {
      parentByChild.set(doc.id, null);
      continue;
    }
    if (wouldCreateCycle(parentByChild, doc.id, parentId)) {
      parentByChild.set(doc.id, null);
      continue;
    }
    parentByChild.set(doc.id, parentId);
    const list = childrenByParent.get(parentId) ?? [];
    list.push(doc.id);
    childrenByParent.set(parentId, list);
  }

  // Restrict to descendants of root.
  const underRoot = new Set<string>([rootDocumentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [childId, parentId] of parentByChild) {
      if (underRoot.has(childId)) continue;
      if (parentId && underRoot.has(parentId)) {
        underRoot.add(childId);
        changed = true;
      }
    }
  }

  const filteredChildren = new Map<string, string[]>();
  for (const [parentId, kids] of childrenByParent) {
    if (!underRoot.has(parentId)) continue;
    filteredChildren.set(
      parentId,
      kids.filter((id) => underRoot.has(id)),
    );
  }

  const buildFiltered = (id: string, stack: Set<string>): WikiTreeNode | null => {
    if (stack.has(id)) return null;
    const doc = byId.get(id);
    if (!doc || !underRoot.has(id)) return null;
    const nextStack = new Set(stack);
    nextStack.add(id);
    const ordered = sortChildren(
      filteredChildren.get(id) ?? [],
      normalized.order[id],
    );
    return {
      id: doc.id,
      title: doc.title?.trim() || "Untitled",
      children: ordered
        .map((childId) => buildFiltered(childId, nextStack))
        .filter((node): node is WikiTreeNode => node != null),
    };
  };

  return buildFiltered(rootDocumentId, new Set());
}

/** Flatten tree to id list (pre-order). */
export function flattenWikiTree(root: WikiTreeNode | null): string[] {
  if (!root) return [];
  const out: string[] = [root.id];
  for (const child of root.children) {
    out.push(...flattenWikiTree(child));
  }
  return out;
}

/** Ancestor chain from root to node (inclusive), or empty if not found. */
export function wikiBreadcrumb(
  root: WikiTreeNode | null,
  documentId: string,
): WikiTreeNode[] {
  if (!root) return [];
  const path: WikiTreeNode[] = [];
  const walk = (node: WikiTreeNode): boolean => {
    path.push(node);
    if (node.id === documentId) return true;
    for (const child of node.children) {
      if (walk(child)) return true;
    }
    path.pop();
    return false;
  };
  return walk(root) ? path : [];
}

export function appendChildOrder(
  layout: WikiLayout,
  parentId: string,
  childId: string,
): WikiLayout {
  const existing = layout.order[parentId] ?? [];
  if (existing.includes(childId)) return layout;
  return {
    v: 1,
    order: {
      ...layout.order,
      [parentId]: [...existing, childId],
    },
  };
}

export function removeChildOrder(
  layout: WikiLayout,
  parentId: string,
  childId: string,
): WikiLayout {
  const existing = layout.order[parentId];
  if (!existing) return layout;
  return {
    v: 1,
    order: {
      ...layout.order,
      [parentId]: existing.filter((id) => id !== childId),
    },
  };
}

export function reorderSiblings(
  layout: WikiLayout,
  parentId: string,
  orderedChildIds: string[],
): WikiLayout {
  return {
    v: 1,
    order: {
      ...layout.order,
      [parentId]: orderedChildIds,
    },
  };
}

/**
 * Resolve a drag: drop onto target (reparent) or before sibling (reorder).
 * `dropPosition`: "on" = reparent under target; "before" | "after" = reorder among target's siblings.
 */
export function resolveWikiDrop(input: {
  draggedId: string;
  targetId: string;
  dropPosition: "on" | "before" | "after";
  rootId: string;
  parentByChild: Map<string, string | null>;
  childrenByParent: Map<string, string[]>;
}): WikiDropResult {
  const { draggedId, targetId, dropPosition, rootId, parentByChild, childrenByParent } =
    input;

  if (draggedId === targetId) {
    return { kind: "invalid", reason: "Can't drop a page on itself" };
  }

  if (dropPosition === "on") {
    if (wouldCreateCycle(parentByChild, draggedId, targetId)) {
      return { kind: "invalid", reason: "Can't move a page under its own descendant" };
    }
    const previousParentId = parentByChild.get(draggedId) ?? null;
    if (previousParentId === targetId) {
      return { kind: "invalid", reason: "Already under that page" };
    }
    return {
      kind: "reparent",
      childId: draggedId,
      newParentId: targetId,
      previousParentId,
    };
  }

  // Reorder relative to target among the same parent — or reparent into that list.
  const targetParent = parentByChild.get(targetId) ?? null;
  // If target is root, only "on" makes sense for nesting; treat before/after root as invalid.
  if (targetId === rootId) {
    return { kind: "invalid", reason: "Drop onto the Space home to nest under it" };
  }

  const newParentId = targetParent ?? rootId;
  const currentParent = parentByChild.get(draggedId) ?? null;

  if (wouldCreateCycle(parentByChild, draggedId, newParentId)) {
    return { kind: "invalid", reason: "Can't move a page under its own descendant" };
  }

  const siblings = [...(childrenByParent.get(newParentId) ?? [])].filter(
    (id) => id !== draggedId,
  );
  const targetIndex = siblings.indexOf(targetId);
  if (targetIndex < 0) {
    return { kind: "invalid", reason: "Couldn't find drop target among siblings" };
  }
  const insertAt = dropPosition === "before" ? targetIndex : targetIndex + 1;
  siblings.splice(insertAt, 0, draggedId);

  if (currentParent !== newParentId) {
    return {
      kind: "reparent",
      childId: draggedId,
      newParentId,
      previousParentId: currentParent,
      orderedChildIds: siblings,
    };
  }

  return {
    kind: "reorder",
    parentId: newParentId,
    orderedChildIds: siblings,
  };
}

export function parentMapFromDocuments(
  documents: WikiDocument[],
  relationField = "origin",
): {
  parentByChild: Map<string, string | null>;
  childrenByParent: Map<string, string[]>;
} {
  const parentByChild = new Map<string, string | null>();
  const childrenByParent = new Map<string, string[]>();
  const ids = new Set(documents.map((d) => d.id));

  for (const doc of documents) {
    const parentId = wikiParentId(doc, relationField);
    if (!parentId || !ids.has(parentId) || parentId === doc.id) {
      parentByChild.set(doc.id, null);
      continue;
    }
    parentByChild.set(doc.id, parentId);
    const list = childrenByParent.get(parentId) ?? [];
    list.push(doc.id);
    childrenByParent.set(parentId, list);
  }

  return { parentByChild, childrenByParent };
}
