"use client";

import type { RemoteEditorPresence } from "@/hooks/useDocumentPresence";
import { formatRemoteNoticeDetail } from "@/lib/documents/remote-document-notice";
import "./DocumentRemoteConflictBanner.css";

type DocumentEditorPresenceOverlayProps = {
  editor: RemoteEditorPresence;
};

export function DocumentEditorPresenceOverlay({
  editor,
}: DocumentEditorPresenceOverlayProps) {
  return (
    <div className="document-editor-presence__overlay" role="status" aria-live="polite">
      <div className="document-editor-presence__card">
        <p className="document-editor-presence__title">
          {editor.displayName} is writing…
        </p>
        <p className="document-editor-presence__detail">
          The document body is temporarily read-only until they finish.
        </p>
      </div>
    </div>
  );
}

type DocumentAwayNoticeBannerProps = {
  notice: {
    actorLabel: string;
    actionLabel: string;
    detail: string | null;
  };
  onDismiss: () => void;
};

export function DocumentAwayNoticeBanner({
  notice,
  onDismiss,
}: DocumentAwayNoticeBannerProps) {
  const label = notice.actorLabel?.trim() || "A collaborator";
  const changeDetail = formatRemoteNoticeDetail(notice);

  return (
    <div className="document-remote-notice document-remote-notice--away" role="status">
      <div>
        <p className="document-remote-notice__message">
          While you were away, <strong>{label}</strong> {notice.actionLabel}.
        </p>
        {changeDetail && (
          <p className="document-remote-notice__detail">{changeDetail}</p>
        )}
      </div>
      <button
        type="button"
        className="document-remote-notice__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss away notice"
      >
        ×
      </button>
    </div>
  );
}

/** @deprecated Use DocumentAwayNoticeBanner */
export const DocumentRemoteNoticeBanner = DocumentAwayNoticeBanner;
