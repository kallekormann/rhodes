"use client";

import { Button } from "@/components/Button";
import {
  blockDiffKindLabel,
  type BlockDiffEntry,
} from "@/lib/documents/block-diff";
import "./DocumentConflictReview.css";

type DocumentConflictReviewProps = {
  diffs: BlockDiffEntry[];
  resolving?: boolean;
  onKeepMine: () => void;
  onTakeTheirs: () => void;
  onClose: () => void;
};

export function DocumentConflictReview({
  diffs,
  resolving = false,
  onKeepMine,
  onTakeTheirs,
  onClose,
}: DocumentConflictReviewProps) {
  return (
    <div
      className="document-conflict-review"
      role="region"
      aria-label="Compare your edits with theirs"
    >
      <div className="document-conflict-review__header">
        <div>
          <p className="document-conflict-review__title">
            Compare changes
          </p>
          <p className="document-conflict-review__hint caption">
            Your document above still shows <strong>your</strong> edits. Below
            is what differs from their saved version. Then choose which version
            stays live — the other is saved to History.
          </p>
        </div>
        <button
          type="button"
          className="document-conflict-review__close"
          onClick={onClose}
          aria-label="Close comparison"
        >
          ×
        </button>
      </div>

      {diffs.length > 0 ? (
        <ul className="document-conflict-review__diff-list">
          {diffs.map((entry) => (
            <li
              key={entry.blockId}
              className={`document-conflict-review__diff-row document-conflict-review__diff-row--${entry.kind}`}
            >
              <span className="document-conflict-review__kind">
                {blockDiffKindLabel(entry.kind)}
              </span>
              <div className="document-conflict-review__columns">
                <div className="document-conflict-review__col">
                  <span className="document-conflict-review__col-label">
                    Yours
                  </span>
                  <p className="document-conflict-review__col-text">
                    {entry.kind === "only_theirs"
                      ? "— (not in your version)"
                      : entry.minePreview || "Empty"}
                  </p>
                </div>
                <div className="document-conflict-review__col">
                  <span className="document-conflict-review__col-label">
                    Theirs
                  </span>
                  <p className="document-conflict-review__col-text">
                    {entry.kind === "only_mine"
                      ? "— (not in their version)"
                      : entry.theirsPreview || "Empty"}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="caption document-conflict-review__empty">
          The text looks similar block-by-block. Title or other fields may still
          differ — pick Keep mine or Use theirs below.
        </p>
      )}

      <div className="document-conflict-review__footer">
        <Button
          variant="secondary"
          size="small"
          disabled={resolving}
          loading={resolving}
          onClick={onKeepMine}
        >
          Keep my edits
        </Button>
        <Button
          variant="primary"
          size="small"
          disabled={resolving}
          onClick={onTakeTheirs}
        >
          Use their version
        </Button>
      </div>
    </div>
  );
}
