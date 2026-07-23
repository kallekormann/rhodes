"use client";

import { useCallback, useEffect, useState } from "react";
import type { BlockConflict } from "@/lib/offline/yjs-offline-divergence";
import { ConflictDiffText } from "@/components/ConflictDiffText";
import "./DocumentConflictFloat.css";

type DocumentConflictFloatProps = {
  conflicts: BlockConflict[];
  onKeep: (blockId: string) => void;
  onDismiss: (blockId: string) => void;
  onActiveConflictChange?: (conflict: BlockConflict | null) => void;
  onScrollToConflict?: (conflict: BlockConflict) => void;
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
    onScrollToConflict?.(active);
  }, [active, onScrollToConflict]);

  const goToIndex = useCallback(
    (index: number) => {
      if (conflicts.length === 0) return;
      const next = ((index % conflicts.length) + conflicts.length) % conflicts.length;
      setActiveIndex(next);
      const conflict = conflicts[next];
      if (conflict) onScrollToConflict?.(conflict);
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
  const versionsDiffer = active.mineText !== active.theirsText;

  return (
    <aside
      className="document-conflict-float"
      role="dialog"
      aria-labelledby="conflict-float-title"
    >
      <div className="document-conflict-float__header">
        <p className="document-conflict-float__eyebrow">Sync conflict</p>
        <h2 id="conflict-float-title" className="document-conflict-float__title">
          Review conflicting edits
        </h2>
        <p className="document-conflict-float__hint">
          {conflicts.length > 1
            ? `Conflict ${position} of ${conflicts.length}. Compare versions below, then choose.`
            : "Compare your offline edit with the online version, then choose."}
        </p>
      </div>

      <div className="document-conflict-float__diff" aria-live="polite">
        <div className="document-conflict-float__diff-section">
          <p className="document-conflict-float__diff-label">Before you went offline</p>
          <p className="document-conflict-float__diff-plain">{active.baseText}</p>
        </div>

        {versionsDiffer && (
          <>
            <div className="document-conflict-float__diff-section">
              <p className="document-conflict-float__diff-label">Your offline edit</p>
              <ConflictDiffText
                baseText={active.baseText}
                text={active.mineText}
                variant="mine"
              />
            </div>

            <div className="document-conflict-float__diff-section">
              <p className="document-conflict-float__diff-label">Online edit (others)</p>
              <ConflictDiffText
                baseText={active.baseText}
                text={active.theirsText}
                variant="theirs"
              />
            </div>
          </>
        )}
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
          title="Use the online version from other editors"
        >
          Dismiss
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={handleKeep}
          title="Keep your offline version"
        >
          Keep
        </button>
      </div>
    </aside>
  );
}
