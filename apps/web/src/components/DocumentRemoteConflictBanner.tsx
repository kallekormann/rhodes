"use client";

import { Button } from "@/components/Button";
import type { DocumentRemoteConflict } from "@/hooks/useDocumentRealtime";
import { formatRemoteNoticeDetail } from "@/lib/documents/remote-document-notice";
import "./DocumentRemoteConflictBanner.css";

type DocumentRemoteConflictBannerProps = {
  conflict: DocumentRemoteConflict;
  onReload: () => void;
  onKeepLocal: () => void;
};

export function DocumentRemoteConflictBanner({
  conflict,
  onReload,
  onKeepLocal,
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
      </div>
      <div className="document-remote-conflict__actions">
        <Button variant="secondary" size="small" onClick={onKeepLocal}>
          Keep mine
        </Button>
        <Button variant="primary" size="small" onClick={onReload}>
          Reload
        </Button>
      </div>
    </div>
  );
}
