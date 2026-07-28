"use client";

import { useEffect, useState } from "react";
import type { ClientErrorEntry } from "@/lib/dev/client-error-log-types";
import { isDebugBannerEnabled } from "@/lib/dev/debug-banner";

const SESSION_KEY = "rhodes:client_errors:v1";

/** Dev-only sources that are routine telemetry, not errors. */
const IGNORED_SOURCES = new Set(["editor-open"]);

function readSessionErrors(): ClientErrorEntry[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const rows = raw ? (JSON.parse(raw) as ClientErrorEntry[]) : [];
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => !IGNORED_SOURCES.has(row.source ?? ""));
  } catch {
    return [];
  }
}

/** TEMP (TD-006): sticky last-error strip — opt-in via __rhodesShowDebugBanner(). */
export function OfflineDebugBanner() {
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState<ClientErrorEntry[]>([]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const bannerEnabled = isDebugBannerEnabled();
    setEnabled(bannerEnabled);
    if (!bannerEnabled) return;

    const refresh = () => setRows(readSessionErrors());
    refresh();

    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("rhodes-error-log", refresh);
    const timer = window.setInterval(refresh, 1_000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("rhodes-error-log", refresh);
      window.clearInterval(timer);
    };
  }, []);

  if (process.env.NODE_ENV === "production" || !enabled || rows.length === 0) {
    return null;
  }

  const last = rows[rows.length - 1];
  if (!last) return null;

  return (
    <div
      className="offline-debug-banner"
      role="status"
      aria-live="polite"
    >
      <strong>Last error</strong> ({last.source ?? "app"}): {last.message}
      <span className="offline-debug-banner__hint">
        Console: <code>await __rhodesCopyErrors()</code>
      </span>
    </div>
  );
}
