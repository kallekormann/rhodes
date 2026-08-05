import type {
  MindMapLayout,
  MindMapNodeLayout,
  MindMapSide,
} from "@rhodes/shared/view-engine";

export const MIND_MAP_NODE_WIDTH = 220;
export const MIND_MAP_NODE_HEIGHT = 56;
const RANK_GAP = 72;
const NODE_GAP = 28;
const ROOT_X = 420;
const ROOT_Y = 280;

function childrenByParent(
  layout: MindMapLayout,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [id, node] of Object.entries(layout.nodes)) {
    if (!node.parentId) continue;
    const list = map.get(node.parentId) ?? [];
    list.push(id);
    map.set(node.parentId, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => {
      const ay = layout.nodes[a]?.y ?? 0;
      const by = layout.nodes[b]?.y ?? 0;
      if (ay !== by) return ay - by;
      return a.localeCompare(b);
    });
  }
  return map;
}

function subtreeHeight(
  nodeId: string,
  kids: Map<string, string[]>,
): number {
  const children = kids.get(nodeId) ?? [];
  if (children.length === 0) return MIND_MAP_NODE_HEIGHT;
  let total = 0;
  for (const child of children) {
    total += subtreeHeight(child, kids);
  }
  total += NODE_GAP * (children.length - 1);
  return total;
}

/**
 * Classic mind-map butterfly layout: root in the center, branches grow
 * left and/or right. Persisted `side` on each root-child controls the
 * direction; descendants follow their branch. Whole subtrees move together
 * when a branch flips sides.
 */
export function layoutMindMapTree(layout: MindMapLayout): MindMapLayout {
  const root = layout.nodes[layout.rootId];
  if (!root) return layout;

  const kids = childrenByParent(layout);
  const positions: Record<string, { x: number; y: number }> = {
    [layout.rootId]: { x: ROOT_X, y: ROOT_Y },
  };

  const rootChildren = kids.get(layout.rootId) ?? [];
  const leftRoots = rootChildren.filter(
    (id) => layout.nodes[id]?.side === "left",
  );
  const rightRoots = rootChildren.filter(
    (id) => layout.nodes[id]?.side !== "left",
  );

  const placeTree = (
    nodeId: string,
    x: number,
    centerY: number,
    direction: 1 | -1,
  ) => {
    positions[nodeId] = {
      x,
      y: Math.round(centerY - MIND_MAP_NODE_HEIGHT / 2),
    };
    const children = kids.get(nodeId) ?? [];
    if (children.length === 0) return;

    const nextX =
      direction === 1
        ? x + MIND_MAP_NODE_WIDTH + RANK_GAP
        : x - MIND_MAP_NODE_WIDTH - RANK_GAP;

    const heights = children.map((child) => subtreeHeight(child, kids));
    const total =
      heights.reduce((sum, h) => sum + h, 0) +
      NODE_GAP * Math.max(0, children.length - 1);
    let y = centerY - total / 2;
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i]!;
      const height = heights[i]!;
      const childCenter = y + height / 2;
      placeTree(child, nextX, childCenter, direction);
      y += height + NODE_GAP;
    }
  };

  const placeForest = (
    branchRoots: string[],
    startX: number,
    direction: 1 | -1,
  ) => {
    if (branchRoots.length === 0) return;
    const heights = branchRoots.map((id) => subtreeHeight(id, kids));
    const total =
      heights.reduce((sum, h) => sum + h, 0) +
      NODE_GAP * Math.max(0, branchRoots.length - 1);
    const rootCenterY = ROOT_Y + MIND_MAP_NODE_HEIGHT / 2;
    let y = rootCenterY - total / 2;
    for (let i = 0; i < branchRoots.length; i += 1) {
      const id = branchRoots[i]!;
      const height = heights[i]!;
      const centerY = y + height / 2;
      placeTree(id, startX, centerY, direction);
      y += height + NODE_GAP;
    }
  };

  placeForest(
    rightRoots,
    ROOT_X + MIND_MAP_NODE_WIDTH + RANK_GAP,
    1,
  );
  placeForest(
    leftRoots,
    ROOT_X - MIND_MAP_NODE_WIDTH - RANK_GAP,
    -1,
  );

  const nodes: Record<string, MindMapNodeLayout> = {};
  for (const [id, node] of Object.entries(layout.nodes)) {
    const pos = positions[id];
    nodes[id] = pos ? { ...node, x: pos.x, y: pos.y } : node;
  }

  return { ...layout, nodes };
}

export function mindMapHandleForSide(side: MindMapSide): string {
  return side === "left" ? "left" : "right";
}

export function sideFromHandleId(
  handleId: string | null | undefined,
): MindMapSide | null {
  if (!handleId) return null;
  if (handleId.includes("left")) return "left";
  if (handleId.includes("right")) return "right";
  return null;
}
