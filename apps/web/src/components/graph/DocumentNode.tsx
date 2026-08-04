"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import "./DocumentNode.css";

/** Stable palette for community/category coloring — cycles for >8 groups. */
export const GRAPH_PALETTE = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#eab308",
  "#14b8a6",
];

export function paletteColor(index: number): string {
  return GRAPH_PALETTE[index % GRAPH_PALETTE.length]!;
}

export type DocumentNodeData = {
  title: string;
  subtitle?: string;
  color?: string;
  /** 0–1 relative size (e.g. degree-normalized); defaults to a compact card. */
  emphasis?: number;
  dimmed?: boolean;
  connectable?: boolean;
};

export function DocumentNode({ data, selected }: NodeProps & { data: DocumentNodeData }) {
  const emphasis = data.emphasis ?? 0;
  const scale = 1 + emphasis * 0.6;

  return (
    <div
      className={`document-node${selected ? " document-node--selected" : ""}${
        data.dimmed ? " document-node--dimmed" : ""
      }`}
      style={{
        transform: `scale(${scale})`,
        borderColor: data.color ?? undefined,
      }}
    >
      {data.connectable !== false ? (
        <>
          <Handle type="target" position={Position.Top} className="document-node__handle" />
          <Handle type="source" position={Position.Bottom} className="document-node__handle" />
        </>
      ) : null}
      <span
        className="document-node__dot"
        style={{ background: data.color ?? "var(--color-accent)" }}
      />
      <div className="document-node__text">
        <span className="document-node__title">{data.title}</span>
        {data.subtitle ? (
          <span className="document-node__subtitle">{data.subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}

export const GRAPH_NODE_TYPES = { document: DocumentNode };
