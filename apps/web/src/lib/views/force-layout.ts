import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

type ForceNode = SimulationNodeDatum & { id: string };

/**
 * Runs a d3-force simulation to completion (synchronously, no animation) and returns
 * final positions. Knowledge Graph is read-only/derived, so we don't need a live ticking
 * simulation — computing a stable layout once per data change is enough.
 */
export function computeForceLayout(
  nodeIds: string[],
  edges: { source: string; target: string }[],
  options?: { width?: number; height?: number; iterations?: number },
): Map<string, { x: number; y: number }> {
  const width = options?.width ?? 900;
  const height = options?.height ?? 640;
  const iterations = options?.iterations ?? 300;

  const nodes: ForceNode[] = nodeIds.map((id) => ({ id }));
  const links: SimulationLinkDatum<ForceNode>[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  const simulation = forceSimulation<ForceNode>(nodes)
    .force(
      "link",
      forceLink<ForceNode, SimulationLinkDatum<ForceNode>>(links)
        .id((node) => node.id)
        .distance(140),
    )
    .force("charge", forceManyBody().strength(-220))
    .force("center", forceCenter(width / 2, height / 2))
    .stop();

  for (let tick = 0; tick < iterations; tick += 1) {
    simulation.tick();
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
  }
  return positions;
}
