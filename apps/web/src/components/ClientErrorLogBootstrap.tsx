"use client";

/** TEMP (TD-004): Install window error hooks before any app shell / editor code runs. */
import "@/lib/dev/client-error-log-init";

export function ClientErrorLogBootstrap() {
  return null;
}
