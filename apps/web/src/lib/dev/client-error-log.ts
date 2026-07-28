/**
 * TEMP (TD-004): Remove after offline editor bug is fixed — see techncial-dept.md § TD-004.
 *
 * Dev client error log — appends to rhodes-app/logs/client-errors.log via API.
 * In-memory ring buffer for the current session (__rhodesErrors in console).
 */

import type { ClientErrorEntry } from "@/lib/dev/client-error-log-types";

export type { ClientErrorEntry } from "@/lib/dev/client-error-log-types";

const API_PATH = "/api/dev/client-errors";
const SESSION_KEY = "rhodes:client_errors:v1";
const MAX_MEMORY_ENTRIES = 80;
const MAX_SESSION_ENTRIES = 80;

const memory: ClientErrorEntry[] = [];

declare global {
  interface Window {
    __rhodesErrorLogInstalled?: boolean;
    __rhodesErrors?: () => Promise<ClientErrorEntry[]>;
    __rhodesClearErrors?: () => Promise<void>;
    __rhodesCopyErrors?: () => Promise<string>;
  }
}

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

function pushSession(row: ClientErrorEntry): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const rows = readSessionErrors();
    rows.push(row);
    while (rows.length > MAX_SESSION_ENTRIES) rows.shift();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(rows));
    window.dispatchEvent(new Event("rhodes-error-log"));
  } catch {
    /* private mode */
  }
}

function clearSession(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function pushMemory(row: ClientErrorEntry): void {
  memory.push(row);
  while (memory.length > MAX_MEMORY_ENTRIES) memory.shift();
}

async function postToLogFile(row: ClientErrorEntry): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  try {
    await fetch(API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
      keepalive: true,
    });
  } catch {
    /* dev server unreachable or DevTools offline */
  }
}

export async function appendClientError(
  entry: Omit<ClientErrorEntry, "id" | "at" | "online"> & { at?: string },
): Promise<void> {
  const row: ClientErrorEntry = {
    id: crypto.randomUUID(),
    at: entry.at ?? new Date().toISOString(),
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    message: entry.message,
    stack: entry.stack,
    source: entry.source,
    url:
      entry.url ??
      (typeof window !== "undefined" ? window.location.href : undefined),
  };

  pushMemory(row);
  pushSession(row);
  void postToLogFile(row);

  console.error(
    `[rhodes-client-error] ${row.source ?? "app"}: ${row.message}`,
    row.stack ?? "",
  );
}

export async function appendDevLog(
  message: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  const row: ClientErrorEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    message,
    source: "debug",
    stack: detail ? JSON.stringify(detail, null, 2) : undefined,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  };

  pushMemory(row);
  pushSession(row);
  if (row.online) {
    void postToLogFile(row);
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug(`[rhodes] ${message}`, detail ?? "");
  }
}

export async function readClientErrors(): Promise<ClientErrorEntry[]> {
  const sessionRows = readSessionErrors();
  if (sessionRows.length > 0) return sessionRows;

  const canReachDevApi =
    process.env.NODE_ENV !== "production" &&
    typeof navigator !== "undefined" &&
    navigator.onLine;

  if (canReachDevApi) {
    try {
      const res = await fetch(API_PATH);
      if (res.ok) {
        const body = (await res.json()) as { rows?: ClientErrorEntry[] };
        if (Array.isArray(body.rows) && body.rows.length > 0) {
          return body.rows;
        }
      }
    } catch {
      /* fall back to memory */
    }
  }

  return [...memory];
}

export async function clearClientErrors(): Promise<void> {
  memory.length = 0;
  clearSession();

  if (
    process.env.NODE_ENV !== "production" &&
    typeof navigator !== "undefined" &&
    navigator.onLine
  ) {
    try {
      await fetch(API_PATH, { method: "DELETE" });
    } catch {
      /* ignore */
    }
  }
}

export function installClientErrorLog(): void {
  if (typeof window === "undefined") return;
  if (window.__rhodesErrorLogInstalled) return;
  window.__rhodesErrorLogInstalled = true;

  window.addEventListener("error", (event) => {
    void appendClientError({
      message: event.message || String(event.error ?? "Unknown error"),
      stack: event.error instanceof Error ? event.error.stack : undefined,
      source: "window.error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";

    if (
      typeof navigator !== "undefined" &&
      !navigator.onLine &&
      message === "Failed to fetch"
    ) {
      return;
    }

    void appendClientError({
      message,
      stack: reason instanceof Error ? reason.stack : undefined,
      source: "unhandledrejection",
    });
  });

  window.__rhodesErrors = async () => {
    const rows = await readClientErrors();
    console.table(rows);
    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[rhodes] Dev error log file: rhodes-app/logs/client-errors.log",
      );
    }
    return rows;
  };
  window.__rhodesCopyErrors = async () => {
    const rows = await readClientErrors();
    const text = JSON.stringify(rows, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      console.info("[rhodes] Copied error log to clipboard");
    } catch {
      console.info(text);
    }
    return text;
  };
  window.__rhodesClearErrors = clearClientErrors;

  if (process.env.NODE_ENV !== "production") {
    console.info(
      "[rhodes] Error log: sessionStorage rhodes:client_errors:v1 — await __rhodesErrors() or await __rhodesCopyErrors()",
    );
  }
}
