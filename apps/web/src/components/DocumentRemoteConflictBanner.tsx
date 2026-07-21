"use client";

import { Button } from "@/components/Button";
import type { DocumentRemoteConflict } from "@/hooks/useDocumentRealtime";
import { formatRemoteNoticeDetail } from "@/lib/documents/remote-document-notice";
import "./DocumentRemoteConflictBanner.css";

type DocumentRemoteConflictBannerProps = {
  conflict: DocumentRemoteConflict;
  resolving?: boolean;
  onKeepMine: () => void;
  onTakeTheirs: () => void;
  onReview: () => void;
  reviewOpen?: boolean;
};

export function DocumentRemoteConflictBanner({
  conflict,
  resolving = false,
  onKeepMine,
  onTakeTheirs,
  onReview,
  reviewOpen = false,
}: DocumentRemoteConflictBannerProps) {
  const label = conflict.actorLabel?.trim() || "A collaborator";
  const changeDetail = formatRemoteNoticeDetail(conflict);

  return (
    <div className="document-remote-conflict" role="status">
      <div className="document-remote-conflict__copy">
        <p className="document-remote-conflict__message">
          <strong>{label}</strong> {conflict.actionLabel} while you were editing.
        </p>
        {changeDetail && (
          <p className="document-remote-conflict__detail">{changeDetail}</p>
        )}
        <p className="document-remote-conflict__detail">
          Choose whose version stays live. The other is saved to History.
        </p>
      </div>
      <div className="document-remote-conflict__actions">
        <Button
          variant="secondary"
          size="small"
          disabled={resolving}
          onClick={onReview}
        >
          {reviewOpen ? "Hide review" : "Review"}
        </Button>
        <Button
          variant="secondary"
          size="small"
          disabled={resolving}
          loading={resolving}
          onClick={onKeepMine}
        >
          Keep mine
        </Button>
        <Button
          variant="primary"
          size="small"
          disabled={resolving}
          onClick={onTakeTheirs}
        >
          Take theirs
        </Button>
      </div>
    </div>
  );
}
