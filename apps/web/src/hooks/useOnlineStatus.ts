"use client";

import { useCallback, useEffect, useState } from "react";

/** Give the network a moment to stabilize after reconnect. */
const RECONNECT_DEFER_MS = 1_000;

function readNavigatorOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useOnlineStatus(_workspaceId?: string | null) {
  const [online, setOnline] = useState(readNavigatorOnline);

  useEffect(() => {
    const syncOnline = () => setOnline(readNavigatorOnline());
    const onOnline = () => setOnline(true);
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
  }, []);

  const onReconnect = useCallback((handler: () => void) => {
    if (typeof window === "undefined") return () => {};
    let deferTimer: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (deferTimer != null) clearTimeout(deferTimer);
      deferTimer = setTimeout(handler, RECONNECT_DEFER_MS);
    };

    window.addEventListener("online", run);
    return () => {
      if (deferTimer != null) clearTimeout(deferTimer);
      window.removeEventListener("online", run);
    };
  }, []);

  return { online, onReconnect };
}
