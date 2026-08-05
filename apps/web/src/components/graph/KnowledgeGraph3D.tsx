"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type MutableRefObject,
} from "react";
import type { ForceGraphMethods } from "react-force-graph-3d";
import { PerspectiveCamera } from "three";
import { LoaderState } from "@/components/Loader";
import "./KnowledgeGraph3D.css";

export type KnowledgeGraph3DNode = {
  id: string;
  name: string;
  color: string;
  /** Relative hub weight 0–1. */
  emphasis: number;
  degree: number;
  /** Document vs library source — distinct sizing/coloring. */
  kind?: "document" | "library";
};

export type KnowledgeGraph3DLink = {
  id: string;
  source: string;
  target: string;
  fieldLabel?: string;
};

type GraphNode = KnowledgeGraph3DNode & {
  __emphasized: boolean;
  __selected: boolean;
};

type GraphLink = {
  id: string;
  source: string;
  target: string;
  fieldLabel?: string;
  __emphasized: boolean;
};

type ForceGraph3DProps = {
  ref?: MutableRefObject<ForceGraphMethods<GraphNode, GraphLink> | undefined>;
  graphData: { nodes: GraphNode[]; links: GraphLink[] };
  width?: number;
  height?: number;
  backgroundColor?: string;
  showNavInfo?: boolean;
  nodeLabel?: string | ((node: GraphNode) => string);
  nodeVal?: (node: GraphNode) => number;
  nodeColor?: (node: GraphNode) => string;
  nodeOpacity?: number;
  linkColor?: (link: GraphLink) => string;
  linkWidth?: (link: GraphLink) => number;
  linkOpacity?: number;
  onNodeClick?: (node: GraphNode) => void;
  cooldownTicks?: number;
  onEngineStop?: () => void;
};

const ForceGraph3D = dynamic(
  () => import("react-force-graph-3d"),
  {
    ssr: false,
    loading: () => <LoaderState label="Loading 3D graph…" size="s" align="fill" />,
  },
) as ComponentType<ForceGraph3DProps>;

function readCssColor(el: HTMLElement, varName: string, fallback: string): string {
  const value = getComputedStyle(el).getPropertyValue(varName).trim();
  return value || fallback;
}

function dimColor(hexOrCss: string): string {
  // Prefer a muted overlay; Three.js accepts CSS color strings.
  if (hexOrCss.startsWith("#") && (hexOrCss.length === 7 || hexOrCss.length === 4)) {
    const full =
      hexOrCss.length === 4
        ? `#${hexOrCss[1]}${hexOrCss[1]}${hexOrCss[2]}${hexOrCss[2]}${hexOrCss[3]}${hexOrCss[3]}`
        : hexOrCss;
    const r = Number.parseInt(full.slice(1, 3), 16);
    const g = Number.parseInt(full.slice(3, 5), 16);
    const b = Number.parseInt(full.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.22)`;
  }
  return "rgba(120, 120, 120, 0.25)";
}

function buildNeighborMap(links: KnowledgeGraph3DLink[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const touch = (a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  };
  for (const link of links) {
    touch(link.source, link.target);
    touch(link.target, link.source);
  }
  return map;
}

/**
 * Matches `.view-document-panel` width: min(100%, max(50vw, 420px)).
 * Used so framing can bias into the uncovered left region.
 */
function estimatePanelInset(canvasWidth: number): number {
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : canvasWidth;
  return Math.min(canvasWidth, Math.max(viewportWidth * 0.5, 420));
}

type FrameOptions = {
  canvasWidth: number;
  canvasHeight: number;
  /** Pixels covered by the right sidebar overlay (0 when closed). */
  rightInset: number;
  durationMs: number;
  /** Multiplier on ego bbox span — higher = more zoomed out. */
  zoomOut?: number;
};

/**
 * Frame a node set into the visible (non-overlay) region: zoom out enough to
 * show neighbors, and bias look-at so the cluster sits in the left half rather
 * than under the document panel.
 */
function frameNodesLeft(
  api: ForceGraphMethods<GraphNode, GraphLink>,
  nodeIds: Set<string>,
  {
    canvasWidth,
    canvasHeight,
    rightInset,
    durationMs,
    zoomOut = 2.6,
  }: FrameOptions,
) {
  if (nodeIds.size === 0 || canvasWidth <= 0 || canvasHeight <= 0) return;

  const bbox = api.getGraphBbox((node) => nodeIds.has(String(node.id)));
  if (!bbox) return;

  const egoCenter = {
    x: (bbox.x[0] + bbox.x[1]) / 2,
    y: (bbox.y[0] + bbox.y[1]) / 2,
    z: (bbox.z[0] + bbox.z[1]) / 2,
  };

  const span = Math.max(
    bbox.x[1] - bbox.x[0],
    bbox.y[1] - bbox.y[0],
    bbox.z[1] - bbox.z[0],
    24,
  );

  const camera = api.camera();
  const fovDeg = camera instanceof PerspectiveCamera ? camera.fov : 50;
  const fovRad = (fovDeg * Math.PI) / 180;
  const aspect = canvasWidth / Math.max(1, canvasHeight);
  const visibleWidth = Math.max(160, canvasWidth - Math.max(0, rightInset));

  // Fit the ego span into the visible strip, then pull back further (zoomOut).
  const worldHeight = span * zoomOut;
  const distForHeight = worldHeight / 2 / Math.tan(fovRad / 2);
  const dist = distForHeight * (canvasWidth / visibleWidth);

  const cur = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  };
  let dir = {
    x: cur.x - egoCenter.x,
    y: cur.y - egoCenter.y,
    z: cur.z - egoCenter.z,
  };
  let dirLen = Math.hypot(dir.x, dir.y, dir.z);
  if (dirLen < 1e-6) {
    dir = { x: 0.55, y: 0.42, z: 1 };
    dirLen = Math.hypot(dir.x, dir.y, dir.z);
  }
  dir = { x: dir.x / dirLen, y: dir.y / dirLen, z: dir.z / dirLen };

  // Camera right = cross(viewDir, worldUp) (Three.js Y-up).
  // Shifting look-at along +right moves the ego cluster to the left of screen
  // center — into the strip not covered by the document panel.
  const viewDir = { x: -dir.x, y: -dir.y, z: -dir.z };
  const up = { x: 0, y: 1, z: 0 };
  let right = {
    x: viewDir.y * up.z - viewDir.z * up.y,
    y: viewDir.z * up.x - viewDir.x * up.z,
    z: viewDir.x * up.y - viewDir.y * up.x,
  };
  let rightLen = Math.hypot(right.x, right.y, right.z);
  if (rightLen < 1e-6) {
    right = { x: 1, y: 0, z: 0 };
    rightLen = 1;
  }
  right = {
    x: right.x / rightLen,
    y: right.y / rightLen,
    z: right.z / rightLen,
  };

  // Shift look-at toward the panel so the ego cluster projects into the
  // center of the uncovered left region (not the full-canvas center).
  const worldWidthAtDist = 2 * dist * Math.tan(fovRad / 2) * aspect;
  const shiftWorld =
    rightInset > 0
      ? worldWidthAtDist * (rightInset / (2 * canvasWidth))
      : 0;

  const lookAt = {
    x: egoCenter.x + right.x * shiftWorld,
    y: egoCenter.y + right.y * shiftWorld,
    z: egoCenter.z + right.z * shiftWorld,
  };

  api.cameraPosition(
    {
      x: lookAt.x + dir.x * dist,
      y: lookAt.y + dir.y * dist,
      z: lookAt.z + dir.z * dist,
    },
    lookAt,
    durationMs,
  );
}

export type KnowledgeGraph3DProps = {
  nodes: KnowledgeGraph3DNode[];
  links: KnowledgeGraph3DLink[];
  selectedId: string | null;
  /** Lowercased trimmed query; empty = no search filter. */
  searchQuery: string;
  onNodeClick: (documentId: string) => void;
  /** Bumps when the match set should be framed (search change). */
  fitToken?: number;
  /** When true, frame selections into the left region clear of the sidebar. */
  panelOpen?: boolean;
};

export function KnowledgeGraph3D({
  nodes,
  links,
  selectedId,
  searchQuery,
  onNodeClick,
  fitToken = 0,
  panelOpen = false,
}: KnowledgeGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(
    undefined,
  );
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [backgroundColor, setBackgroundColor] = useState("#1c1c1e");
  const [linkDimColor, setLinkDimColor] = useState("rgba(140,140,140,0.18)");
  const [linkBrightColor, setLinkBrightColor] = useState("rgba(200,200,200,0.85)");
  const didInitialFit = useRef(false);
  const lastFramedSelection = useRef<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const syncTheme = () => {
      setBackgroundColor(readCssColor(el, "--color-surface-hover", "#1c1c1e"));
      const border = readCssColor(el, "--color-border", "#888");
      const text = readCssColor(el, "--color-text-secondary", "#ccc");
      setLinkDimColor(dimColor(border));
      setLinkBrightColor(text);
    };
    syncTheme();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({
        width: Math.max(0, Math.floor(width)),
        height: Math.max(0, Math.floor(height)),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const neighbors = useMemo(() => buildNeighborMap(links), [links]);

  const egoSet = useMemo(() => {
    if (!selectedId) return null;
    const set = new Set<string>([selectedId]);
    for (const id of neighbors.get(selectedId) ?? []) set.add(id);
    return set;
  }, [selectedId, neighbors]);

  const matchSet = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    for (const node of nodes) {
      if (node.name.toLowerCase().includes(q)) set.add(node.id);
    }
    return set;
  }, [nodes, searchQuery]);

  const graphData = useMemo(() => {
    const graphNodes: GraphNode[] = nodes.map((node) => {
      const matches = matchSet == null || matchSet.has(node.id);
      const inEgo = egoSet == null || egoSet.has(node.id);
      return {
        ...node,
        __emphasized: matches && inEgo,
        __selected: node.id === selectedId,
      };
    });

    const graphLinks: GraphLink[] = links.map((link) => {
      const sourceId = link.source;
      const targetId = link.target;
      const bothEmphasized =
        (matchSet == null || (matchSet.has(sourceId) && matchSet.has(targetId))) &&
        (egoSet == null ||
          (egoSet.has(sourceId) && egoSet.has(targetId)));
      return {
        ...link,
        __emphasized: bothEmphasized,
      };
    });

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, links, matchSet, egoSet, selectedId]);

  const rightInset = panelOpen ? estimatePanelInset(size.width) : 0;

  const fitToRelevant = useCallback(
    (durationMs = 600) => {
      const api = graphRef.current;
      if (!api || size.width <= 0 || size.height <= 0) return;

      if (egoSet && egoSet.size > 0) {
        frameNodesLeft(api, egoSet, {
          canvasWidth: size.width,
          canvasHeight: size.height,
          rightInset,
          durationMs,
          zoomOut: 2.8,
        });
        return;
      }

      if (matchSet && matchSet.size > 0) {
        if (rightInset > 0) {
          frameNodesLeft(api, matchSet, {
            canvasWidth: size.width,
            canvasHeight: size.height,
            rightInset,
            durationMs,
            zoomOut: 2.2,
          });
        } else {
          api.zoomToFit(durationMs, 72, (node) => matchSet.has(String(node.id)));
        }
        return;
      }

      api.zoomToFit(durationMs, 64);
    },
    [matchSet, egoSet, size.width, size.height, rightInset],
  );

  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    if (!didInitialFit.current && graphData.nodes.length > 0) {
      didInitialFit.current = true;
      const timer = window.setTimeout(() => fitToRelevant(0), 80);
      return () => window.clearTimeout(timer);
    }
  }, [size, graphData.nodes.length, fitToRelevant]);

  useEffect(() => {
    if (fitToken === 0) return;
    const timer = window.setTimeout(() => fitToRelevant(500), 40);
    return () => window.clearTimeout(timer);
  }, [fitToken, fitToRelevant]);

  // On node select (or panel open while selected): reframe into the left strip.
  useEffect(() => {
    if (!selectedId || !egoSet || egoSet.size === 0) {
      lastFramedSelection.current = null;
      return;
    }
    if (size.width <= 0 || size.height <= 0) return;

    const frameKey = `${selectedId}:${rightInset > 0 ? "panel" : "full"}`;
    if (lastFramedSelection.current === frameKey) return;
    lastFramedSelection.current = frameKey;

    const timer = window.setTimeout(() => fitToRelevant(700), 60);
    return () => window.clearTimeout(timer);
  }, [selectedId, egoSet, rightInset, size.width, size.height, fitToRelevant]);

  useEffect(() => {
    didInitialFit.current = false;
    lastFramedSelection.current = null;
  }, [nodes.length, links.length]);

  return (
    <div ref={containerRef} className="knowledge-graph-3d">
      {size.width > 0 && size.height > 0 ? (
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor={backgroundColor}
          showNavInfo={false}
          nodeLabel={(node) => node.name}
          nodeVal={(node) => {
            const base = node.kind === "library" ? 1.4 : 2;
            const boost = node.kind === "library" ? 4 : 10;
            return base + node.emphasis * boost + (node.__selected ? 2 : 0);
          }}
          nodeColor={(node) =>
            node.__emphasized
              ? node.__selected
                ? node.color
                : node.color
              : dimColor(node.color)
          }
          nodeOpacity={0.95}
          linkColor={(link) =>
            link.__emphasized ? linkBrightColor : linkDimColor
          }
          linkWidth={(link) => (link.__emphasized ? 1.6 : 0.4)}
          linkOpacity={0.9}
          onNodeClick={(node) => onNodeClick(String(node.id))}
          cooldownTicks={80}
          onEngineStop={() => {
            if (!didInitialFit.current && graphData.nodes.length > 0) {
              didInitialFit.current = true;
              fitToRelevant(0);
            }
          }}
        />
      ) : null}
    </div>
  );
}
