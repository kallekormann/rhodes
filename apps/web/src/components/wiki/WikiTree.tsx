"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Plus } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import type { WikiTreeNode } from "@/lib/views/wiki";
import "./WikiTree.css";

/** Survives browsers that empty dataTransfer.getData until drop completes. */
let activeWikiDragId: string | null = null;

export type WikiTreeProps = {
  root: WikiTreeNode;
  selectedId: string | null;
  canWrite: boolean;
  filter: string;
  onSelect: (documentId: string) => void;
  onAddChild: (parentId: string) => void;
  onDrop: (
    draggedId: string,
    targetId: string,
    position: "on" | "before" | "after",
  ) => void;
};

function matchesFilter(node: WikiTreeNode, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  if (node.title.toLowerCase().includes(q)) return true;
  return node.children.some((child) => matchesFilter(child, filter));
}

/** Ancestor ids from root down to (but not including) `targetId`. */
function ancestorsOf(
  node: WikiTreeNode,
  targetId: string,
  trail: string[] = [],
): string[] | null {
  if (node.id === targetId) return trail;
  for (const child of node.children) {
    const found = ancestorsOf(child, targetId, [...trail, node.id]);
    if (found) return found;
  }
  return null;
}

function WikiTreeRow({
  node,
  depth,
  selectedId,
  canWrite,
  filter,
  expanded,
  onToggle,
  onSelect,
  onAddChild,
  onDrop,
}: {
  node: WikiTreeNode;
  depth: number;
  selectedId: string | null;
  canWrite: boolean;
  filter: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onAddChild: (id: string) => void;
  onDrop: (
    draggedId: string,
    targetId: string,
    position: "on" | "before" | "after",
  ) => void;
}) {
  const filtering = Boolean(filter.trim());
  const isOpen = expanded.has(node.id) || filtering;
  const hasChildren = node.children.length > 0;
  const selected = selectedId === node.id;
  const visibleChildren = node.children.filter((child) =>
    matchesFilter(child, filter),
  );
  const title = node.title.trim() || "Untitled";

  return (
    <li
      className="wiki-tree__item"
      role="treeitem"
      aria-selected={selected}
      aria-expanded={hasChildren ? isOpen : undefined}
    >
      <div
        className={`wiki-tree__row${selected ? " wiki-tree__row--selected" : ""}`}
        style={{ ["--wiki-tree-depth" as string]: String(depth) }}
        draggable={canWrite}
        onDragStart={(event) => {
          activeWikiDragId = node.id;
          event.dataTransfer.setData("text/wiki-doc-id", node.id);
          event.dataTransfer.setData("text/plain", node.id);
          event.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          activeWikiDragId = null;
        }}
        onDragOver={(event) => {
          if (!canWrite) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          const rect = event.currentTarget.getBoundingClientRect();
          const y = event.clientY - rect.top;
          const ratio = y / rect.height;
          // Wider middle band = nest under target (updates Origin).
          event.currentTarget.dataset.drop =
            ratio < 0.2 ? "before" : ratio > 0.8 ? "after" : "on";
        }}
        onDragLeave={(event) => {
          delete event.currentTarget.dataset.drop;
        }}
        onDrop={(event) => {
          if (!canWrite) return;
          event.preventDefault();
          const draggedId =
            event.dataTransfer.getData("text/wiki-doc-id") ||
            event.dataTransfer.getData("text/plain") ||
            activeWikiDragId ||
            "";
          const position =
            (event.currentTarget.dataset.drop as "on" | "before" | "after") ||
            "on";
          delete event.currentTarget.dataset.drop;
          activeWikiDragId = null;
          if (!draggedId) return;
          onDrop(draggedId, node.id, position);
        }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="wiki-tree__twist"
            aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isOpen ? (
              <ChevronDown size={14} strokeWidth={2} aria-hidden />
            ) : (
              <ChevronRight size={14} strokeWidth={2} aria-hidden />
            )}
          </button>
        ) : (
          <span className="wiki-tree__twist wiki-tree__twist--empty" aria-hidden />
        )}
        <FileText
          className="wiki-tree__doc-icon"
          size={14}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="wiki-tree__title" title={title}>
          {title}
        </span>
        {canWrite ? (
          <span className="wiki-tree__actions">
            <IconButton
              icon={Plus}
              label={`Add page under ${title}`}
              size="small"
              iconSize={14}
              onClick={(event) => {
                event.stopPropagation();
                onAddChild(node.id);
              }}
            />
          </span>
        ) : null}
      </div>
      {hasChildren && isOpen ? (
        <ul className="wiki-tree__list" role="group">
          {visibleChildren.map((child) => (
            <WikiTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              canWrite={canWrite}
              filter={filter}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDrop={onDrop}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WikiTree({
  root,
  selectedId,
  canWrite,
  filter,
  onSelect,
  onAddChild,
  onDrop,
}: WikiTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([root.id]),
  );

  useEffect(() => {
    setExpanded((prev) => {
      if (prev.has(root.id)) return prev;
      const next = new Set(prev);
      next.add(root.id);
      return next;
    });
  }, [root.id]);

  useEffect(() => {
    if (!selectedId) return;
    const trail = ancestorsOf(root, selectedId);
    if (!trail || trail.length === 0) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of trail) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [root, selectedId]);

  const onToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!matchesFilter(root, filter)) {
    return (
      <p className="caption wiki-tree__empty">No pages match this filter.</p>
    );
  }

  return (
    <ul className="wiki-tree" role="tree" aria-label="Wiki pages">
      <WikiTreeRow
        node={root}
        depth={0}
        selectedId={selectedId}
        canWrite={canWrite}
        filter={filter}
        expanded={expanded}
        onToggle={onToggle}
        onSelect={onSelect}
        onAddChild={onAddChild}
        onDrop={onDrop}
      />
    </ul>
  );
}
