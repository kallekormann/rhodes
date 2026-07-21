"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pullWorkspaceDocuments, pushOutbox } from "@/lib/offline/sync-engine";

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

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      retrySync();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [retrySync]);

  return { online, retrySync };
}
