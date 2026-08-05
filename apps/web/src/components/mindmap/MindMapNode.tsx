"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { MindMapSide } from "@rhodes/shared/view-engine";
import { DocumentCard } from "@/components/DocumentCard";
import { IconButton } from "@/components/IconButton";
import "./MindMapNode.css";

export type MindMapNodeData = {
  title: string;
  placeholder?: boolean;
  isRoot?: boolean;
  side?: MindMapSide | null;
  canAddChild?: boolean;
  canDelete?: boolean;
  onAddChild?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onOpen?: (nodeId: string) => void;
};

export function MindMapNode({
  id,
  data,
  selected,
}: NodeProps & { data: MindMapNodeData }) {
  const [hovered, setHovered] = useState(false);
  const showActions = Boolean(data.canAddChild || data.canDelete);
  const actionsVisible = showActions && (hovered || selected);
  const side = data.side === "left" ? "left" : "right";

  return (
    <div
      className={[
        "mindmap-node",
        selected ? "mindmap-node--selected" : "",
        actionsVisible ? "mindmap-node--actions-visible" : "",
        data.isRoot ? "mindmap-node--root" : "",
        !data.isRoot ? `mindmap-node--${side}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* One connector per side. ConnectionMode.Loose lets each handle
          start or receive edges (including many edges from the same circle). */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="mindmap-node__handle"
        isConnectable
      />
      <div className="mindmap-node__body">
        <DocumentCard
          title={data.title}
          placeholder={data.placeholder}
          selected={selected}
          onClick={() => data.onOpen?.(id)}
        />
        {showActions ? (
          <div
            className="mindmap-node__actions nodrag nopan"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {data.canAddChild ? (
              <IconButton
                icon={Plus}
                label="Add child"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  data.onAddChild?.(id);
                }}
              />
            ) : null}
            {data.canDelete ? (
              <IconButton
                icon={Trash2}
                label="Delete node"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  data.onDelete?.(id);
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="mindmap-node__handle"
        isConnectable
      />
    </div>
  );
}

export const MIND_MAP_NODE_TYPES = { mindmap: MindMapNode };
