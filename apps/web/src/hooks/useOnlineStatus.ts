"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pullWorkspaceDocuments, pushOutbox } from "@/lib/offline/sync-engine";

/** Give the network a moment to stabilize before retrying queued patches. */
const RECONNECT_PUSH_DEFER_MS = 1_000;

export function useOnlineStatus(workspaceId?: string | null) {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
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
    const onOnline = () => {
      setOnline(true);
      scheduleRetrySync();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [scheduleRetrySync]);

  return { online, retrySync };
}
