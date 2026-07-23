"use client";

import type { BlockConflict } from "@/lib/offline/yjs-offline-divergence";
import "./DocumentConflictFloat.css";
import "./DocumentConflictReview.css";

type DocumentConflictFloatProps = {
  conflicts: BlockConflict[];
  onKeepMine: (blockId: string) => void;
  onTakeTheirs: (blockId: string) => void;
  onKeepAllMine: () => void;
  onTakeAllTheirs: () => void;
};

export function DocumentConflictFloat({
  conflicts,
  onKeepMine,
  onTakeTheirs,
  onKeepAllMine,
  onTakeAllTheirs,
}: DocumentConflictFloatProps) {
  if (conflicts.length === 0) return null;

  const active = conflicts[0];

  return (
    <aside className="document-conflict-float" role="dialog" aria-labelledby="conflict-float-title">
      <div className="document-conflict-float__header">
        <p className="document-conflict-float__eyebrow">Sync conflict</p>
        <h2 id="conflict-float-title" className="document-conflict-float__title">
          Review your offline edits
        </h2>
        <p className="document-conflict-float__hint">
          Someone else edited the same text while you were offline. Choose which
          version to keep for this block.
        </p>
      </div>

      <div className="document-conflict-review__diff-row document-conflict-review__diff-row--changed">
        <span className="document-conflict-review__kind">Block {active.blockIndex + 1}</span>
        <div className="document-conflict-review__columns">
          <div className="document-conflict-review__col">
            <span className="document-conflict-review__col-label">Yours</span>
            <p className="document-conflict-review__col-text">
              {active.mineText || "(empty)"}
            </p>
          </div>
          <div className="document-conflict-review__col">
            <span className="document-conflict-review__col-label">Theirs</span>
            <p className="document-conflict-review__col-text">
              {active.theirsText || "(empty)"}
            </p>
          </div>
        </div>
      </div>

      <div className="document-conflict-float__actions">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => onKeepMine(active.blockId)}
        >
          Keep mine
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => onTakeTheirs(active.blockId)}
        >
          Take theirs
        </button>
      </div>

      {conflicts.length > 1 && (
        <div className="document-conflict-float__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onKeepAllMine}
          >
            Keep all mine ({conflicts.length})
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onTakeAllTheirs}
          >
            Take all theirs
          </button>
        </div>
      )}
    </aside>
  );
}
