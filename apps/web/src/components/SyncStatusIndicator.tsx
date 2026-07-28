"use client";

import { useEffect, useState } from "react";
import type { OfflineSyncStatus } from "@/lib/offline/db";
import {
  getDocumentSyncStatus,
  subscribeSyncEngine,
} from "@/lib/offline/sync-engine";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import "./SyncStatusIndicator.css";

type SyncStatusIndicatorProps = {
  documentId: string | null;
  workspaceId?: string | null;
};

export function SyncStatusIndicator({
  documentId,
  workspaceId,
}: SyncStatusIndicatorProps) {
  const { online } = useOnlineStatus(workspaceId);
  const [status, setStatus] = useState<OfflineSyncStatus | null>(null);

  useEffect(() => {
    if (!documentId) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    void getDocumentSyncStatus(documentId).then((value) => {
      if (!cancelled) setStatus(value);
    });

    return subscribeSyncEngine((event) => {
      if (event.documentId !== documentId) return;
      if (event.status) setStatus(event.status);
    });
  }, [documentId]);

  if (!documentId) return null;

  if (!online) {
    if (status === "pending") {
      return (
        <span
          className="sync-status sync-status--pending"
          title="Saved on this device — will sync when you're back online"
        >
          Pending sync
        </span>
      );
    }
    return (
      <span className="sync-status sync-status--offline" title="Offline">
        Offline
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="sync-status sync-status--pending" title="Saving…">
        Saving…
      </span>
    );
  }

  if (status === "conflict") {
    return (
      <span className="sync-status sync-status--conflict" title="Sync conflict">
        Conflict
      </span>
    );
  }

  return null;
}
