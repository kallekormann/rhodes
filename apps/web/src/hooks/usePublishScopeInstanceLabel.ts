"use client";

import { useEffect } from "react";
import { useApp } from "@/context/AppContext";

/** Publishes the active board/tab label to the app header trail. Clears on unmount. */
export function usePublishScopeInstanceLabel(label: string | null | undefined) {
  const { setScopeInstanceLabel } = useApp();

  useEffect(() => {
    const next = label?.trim() ? label.trim() : null;
    setScopeInstanceLabel(next);
    return () => setScopeInstanceLabel(null);
  }, [label, setScopeInstanceLabel]);
}
