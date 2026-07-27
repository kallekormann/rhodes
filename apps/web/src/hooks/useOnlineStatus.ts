"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pullWorkspaceDocuments, pushOutbox } from "@/lib/offline/sync-engine";

/** Give the network a moment to stabilize before retrying queued patches. */
const RECONNECT_PUSH_DEFER_MS = 1_000;

function readNavigatorOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useOnlineStatus(workspaceId?: string | null) {
  const [online, setOnline] = useState(readNavigatorOnline);
  const workspaceIdRef = useRef(workspaceId);
  workspaceIdRef.current = workspaceId;

  const retrySync = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;
    void (async () => {
      await pushOutbox();
      const ws = workspaceIdRef.current;
      if (ws) await pullWorkspaceDocuments(ws);
    })();
  }, []);

  const scheduleRetrySync = useCallback(() => {
    if (typeof window === "undefined") {
      retrySync();
      return;
    }
    window.setTimeout(() => {
      retrySync();
    }, RECONNECT_PUSH_DEFER_MS);
  }, [retrySync]);

  useEffect(() => {
    const syncOnline = () => setOnline(readNavigatorOnline());
    const onOnline = () => {
      setOnline(true);
      scheduleRetrySync();
    };
    const onOffline = () => setOnline(false);

    syncOnline();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", syncOnline);
    document.addEventListener("visibilitychange", syncOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", syncOnline);
      document.removeEventListener("visibilitychange", syncOnline);
    };
  }, [scheduleRetrySync]);

  return { online, retrySync };
}
