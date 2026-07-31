"use client";

import { useEffect, useRef, useState } from "react";
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

type DisplayPhase =
  | "hidden"
  | "saving"
  | "saved"
  | "offline"
  | "pending_sync"
  | "conflict";

const SAVING_SHOW_DELAY_MS = 400;
const SAVED_VISIBLE_MS = 2500;

export function SyncStatusIndicator({
  documentId,
  workspaceId,
}: SyncStatusIndicatorProps) {
  const { online } = useOnlineStatus(workspaceId);
  const [rawStatus, setRawStatus] = useState<OfflineSyncStatus | null>(null);
  const [displayPhase, setDisplayPhase] = useState<DisplayPhase>("hidden");

  const displayPhaseRef = useRef(displayPhase);
  displayPhaseRef.current = displayPhase;

  const savingDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadPendingWorkRef = useRef(false);

  const clearSavingDelayTimer = () => {
    if (savingDelayTimerRef.current) {
      clearTimeout(savingDelayTimerRef.current);
      savingDelayTimerRef.current = null;
    }
  };

  const clearSavedHideTimer = () => {
    if (savedHideTimerRef.current) {
      clearTimeout(savedHideTimerRef.current);
      savedHideTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!documentId) {
      setRawStatus(null);
      return;
    }

    let cancelled = false;
    void getDocumentSyncStatus(documentId)
      .then((value) => {
        if (!cancelled) setRawStatus(value);
      })
      .catch(() => {
        /* vault may still be unlocking on cold load */
      });

    return subscribeSyncEngine((event) => {
      if (event.documentId !== documentId) return;
      if (event.status) setRawStatus(event.status);
    });
  }, [documentId]);

  useEffect(() => {
    if (!documentId) {
      setDisplayPhase("hidden");
      return;
    }

    if (!online) {
      clearSavingDelayTimer();
      clearSavedHideTimer();
      setDisplayPhase(rawStatus === "pending" ? "pending_sync" : "offline");
      hadPendingWorkRef.current = false;
      return;
    }

    if (rawStatus === "conflict") {
      clearSavingDelayTimer();
      clearSavedHideTimer();
      hadPendingWorkRef.current = false;
      setDisplayPhase("conflict");
      return;
    }

    if (rawStatus === "pending") {
      hadPendingWorkRef.current = true;
      clearSavedHideTimer();

      if (displayPhaseRef.current !== "saving" && !savingDelayTimerRef.current) {
        savingDelayTimerRef.current = setTimeout(() => {
          savingDelayTimerRef.current = null;
          setDisplayPhase("saving");
        }, SAVING_SHOW_DELAY_MS);
      }
      return;
    }

    clearSavingDelayTimer();

    const shouldConfirmSave =
      hadPendingWorkRef.current ||
      displayPhaseRef.current === "saving" ||
      displayPhaseRef.current === "saved";

    if (shouldConfirmSave) {
      hadPendingWorkRef.current = false;
      setDisplayPhase("saved");
      clearSavedHideTimer();
      savedHideTimerRef.current = setTimeout(() => {
        savedHideTimerRef.current = null;
        setDisplayPhase("hidden");
      }, SAVED_VISIBLE_MS);
      return;
    }

    if (displayPhaseRef.current !== "saved") {
      setDisplayPhase("hidden");
    }
  }, [documentId, online, rawStatus]);

  useEffect(
    () => () => {
      clearSavingDelayTimer();
      clearSavedHideTimer();
    },
    [],
  );

  if (!documentId) return null;

  if (displayPhase === "offline") {
    return (
      <span className="sync-status sync-status--offline" title="Offline">
        Offline
      </span>
    );
  }

  if (displayPhase === "pending_sync") {
    return (
      <span
        className="sync-status sync-status--pending"
        title="Saved on this device — will sync when you're back online"
      >
        Pending sync
      </span>
    );
  }

  if (displayPhase === "saving") {
    return (
      <span className="sync-status sync-status--pending" title="Saving…">
        Saving…
      </span>
    );
  }

  if (displayPhase === "saved") {
    return (
      <span className="sync-status sync-status--saved" title="All changes saved">
        Saved
      </span>
    );
  }

  if (displayPhase === "conflict") {
    return (
      <span className="sync-status sync-status--conflict" title="Sync conflict">
        Conflict
      </span>
    );
  }

  return null;
}
