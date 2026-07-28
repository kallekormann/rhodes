"use client";

import { useEffect, useState } from "react";
import type { ClientErrorEntry } from "@/lib/dev/client-error-log-types";

const SESSION_KEY = "rhodes:client_errors:v1";

function readSessionErrors(): ClientErrorEntry[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const rows = raw ? (JSON.parse(raw) as ClientErrorEntry[]) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** TEMP (TD-004): sticky last-error strip — survives editor crashes / navigation. */
export function OfflineDebugBanner() {
  const [rows, setRows] = useState<ClientErrorEntry[]>([]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

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

  if (process.env.NODE_ENV === "production" || rows.length === 0) {
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
