"use client";

import type { ReactNode } from "react";

/** Passthrough wrapper — sync UI is driven by workspace sync state in DocumentsView. */
export function DocumentsSyncGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
