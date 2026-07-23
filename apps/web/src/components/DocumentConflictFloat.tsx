"use client";

import { useCallback, useEffect, useState } from "react";
import type { BlockConflict } from "@/lib/offline/yjs-offline-divergence";
import "./DocumentConflictFloat.css";

type DocumentConflictFloatProps = {
  conflicts: BlockConflict[];
  onKeep: (blockId: string) => void;
  onDismiss: (blockId: string) => void;
  onActiveConflictChange?: (conflict: BlockConflict | null) => void;
  onScrollToConflict?: (blockId: string) => void;
};

export function DocumentConflictFloat({
  conflicts,
  onKeep,
  onDismiss,
  onActiveConflictChange,
  onScrollToConflict,
}: DocumentConflictFloatProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [conflicts]);

  const active =
    conflicts.length > 0
      ? conflicts[Math.min(activeIndex, conflicts.length - 1)]
      : null;

  useEffect(() => {
    onActiveConflictChange?.(active);
  }, [active, onActiveConflictChange]);

  useEffect(() => {
    if (!active) return;
    onScrollToConflict?.(active.blockId);
  }, [active?.blockId, onScrollToConflict]);

  const goToIndex = useCallback(
    (index: number) => {
      if (conflicts.length === 0) return;
      const next = ((index % conflicts.length) + conflicts.length) % conflicts.length;
      setActiveIndex(next);
      const conflict = conflicts[next];
      if (conflict) onScrollToConflict?.(conflict.blockId);
    },
    [conflicts, onScrollToConflict],
  );

  const handleNext = useCallback(() => {
    goToIndex(activeIndex + 1);
  }, [activeIndex, goToIndex]);

  const handleKeep = useCallback(() => {
    if (!active) return;
    onKeep(active.blockId);
    if (conflicts.length > 1) {
      setActiveIndex((index) => Math.min(index, conflicts.length - 2));
    }
  }, [active, conflicts.length, onKeep]);

  const handleDismiss = useCallback(() => {
    if (!active) return;
    onDismiss(active.blockId);
    if (conflicts.length > 1) {
      setActiveIndex((index) => Math.min(index, conflicts.length - 2));
    }
  }, [active, conflicts.length, onDismiss]);

  if (!active) return null;

  const position = Math.min(activeIndex, conflicts.length - 1) + 1;

  return (
    <aside
      className="document-conflict-float"
      role="dialog"
      aria-labelledby="conflict-float-title"
    >
      <div className="document-conflict-float__header">
        <p className="document-conflict-float__eyebrow">Sync conflict</p>
        <h2 id="conflict-float-title" className="document-conflict-float__title">
          Review highlighted text
        </h2>
        <p className="document-conflict-float__hint">
          {conflicts.length > 1
            ? `Conflict ${position} of ${conflicts.length}. Use Next to jump between blocks.`
            : "Choose whether to keep your offline edit or dismiss it."}
        </p>
      </div>

      <div className="document-conflict-float__actions">
        {conflicts.length > 1 && (
          <button
            type="button"
            className="btn btn--ghost btn--sm document-conflict-float__btn-next"
            onClick={handleNext}
          >
            Next
          </button>
        )}
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={handleDismiss}
        >
          Dismiss
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={handleKeep}
        >
          Keep
        </button>
      </div>
    </aside>
  );
}
