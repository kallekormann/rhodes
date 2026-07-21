"use client";

import { TipTapEditor } from "@/components/editor/TipTapEditor";
import {
  blockDiffKindLabel,
  type BlockDiffEntry,
} from "@/lib/documents/block-diff";
import "./DocumentConflictReview.css";

type DocumentConflictReviewProps = {
  theirsContent: Record<string, unknown> | null;
  diffs: BlockDiffEntry[];
  onClose: () => void;
};

export function DocumentConflictReview({
  theirsContent,
  diffs,
  onClose,
}: DocumentConflictReviewProps) {
  return (
    <div className="document-conflict-review" role="region" aria-label="Conflict review">
      <div className="document-conflict-review__header">
        <div>
          <p className="document-conflict-review__title">Their version</p>
          <p className="document-conflict-review__hint caption">
            Your live editor keeps your version. Compare blocks below, then Keep
            mine or Take theirs.
          </p>
        </div>
        <button
          type="button"
          className="document-conflict-review__close"
          onClick={onClose}
          aria-label="Close review"
        >
          ×
        </button>
      </div>

      {diffs.length > 0 ? (
        <ul className="document-conflict-review__diff-list">
          {diffs.map((entry) => (
            <li key={entry.blockId} className="document-conflict-review__diff-row">
              <span className={`document-conflict-review__kind document-conflict-review__kind--${entry.kind}`}>
                {blockDiffKindLabel(entry.kind)}
              </span>
              <span className="document-conflict-review__preview">
                {entry.kind === "only_theirs"
                  ? entry.theirsPreview
                  : entry.kind === "only_mine"
                    ? entry.minePreview
                    : `Yours: ${entry.minePreview} · Theirs: ${entry.theirsPreview}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="caption document-conflict-review__empty">
          No block-level differences detected (titles or metadata may still differ).
        </p>
      )}

      <div className="document-conflict-review__preview-editor overlay-scrollbar">
        <TipTapEditor
          key="conflict-theirs-preview"
          content={theirsContent ?? { type: "doc", content: [{ type: "paragraph" }] }}
          contentSyncToken={1}
          editable={false}
          onUpdate={() => undefined}
        />
      </div>
    </div>
  );
}
