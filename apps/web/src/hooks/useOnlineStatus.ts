"use client";

import { useCallback, useEffect, useState } from "react";
import { pushOutbox } from "@/lib/offline/sync-engine";

export function useOnlineStatus() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void pushOutbox();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const retrySync = useCallback(() => {
    if (!navigator.onLine) return;
    void pushOutbox();
  }, []);

  return { online, retrySync };
}
