"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Scope } from "@/data/scopes";
import { Button } from "@/components/Button";
import { GroupLabel } from "@/components/SectionHeader";
import { clearSyncedOfflineCache } from "@/lib/offline/db";
import {
  estimateIdbStorage,
  IDB_QUOTA_WARN_RATIO,
  type IdbStorageEstimate,
} from "@/lib/offline/idb-quota-monitor";
import { formatLibraryFileSize } from "@/lib/library/format";
import {
  getOfflineCacheStats,
  type OfflineCacheStats,
} from "@/lib/offline/offline-storage-stats";
import "./OfflineStoragePanel.css";

type OfflineStoragePanelProps = {
  scopes: Scope[];
  onCleared?: () => void;
};

export function OfflineStoragePanel({
  scopes,
  onCleared,
}: OfflineStoragePanelProps) {
  const [stats, setStats] = useState<OfflineCacheStats | null>(null);
  const [estimate, setEstimate] = useState<IdbStorageEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const scope of scopes) {
      map.set(scope.id, scope.name);
    }
    return map;
  }, [scopes]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextStats, nextEstimate] = await Promise.all([
        getOfflineCacheStats(),
        estimateIdbStorage(),
      ]);
      setStats(nextStats);
      setEstimate(nextEstimate);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load offline storage",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleClear = async () => {
    if (
      !window.confirm(
        "Clear cached documents on this device? Unsynced edits in the outbox are also removed. Your account data on the server is not affected.",
      )
    ) {
      return;
    }

    setClearing(true);
    setError(null);
    try {
      await clearSyncedOfflineCache();
      await refresh();
      onCleared?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to clear offline cache",
      );
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return <p className="caption settings-field__hint">Loading offline cache…</p>;
  }

  if (error) {
    return <p className="caption settings-field__hint">{error}</p>;
  }

  const usageBytes = estimate?.usageBytes ?? null;
  const quotaBytes = estimate?.quotaBytes ?? null;
  const ratio = estimate?.ratio ?? null;
  const nearLimit = ratio != null && ratio >= IDB_QUOTA_WARN_RATIO;
  const docCount = stats?.totalDocuments ?? 0;

  return (
    <div className="offline-storage-panel">
      <p className="caption settings-field__hint">
        {docCount} document{docCount === 1 ? "" : "s"} cached on this device for
        offline use. Rhodes keeps recently opened documents per scope (up to 100
        each) and removes older synced copies automatically.
      </p>

      {stats && stats.workspaces.length > 0 && (
        <ul className="offline-storage-panel__breakdown">
          {stats.workspaces.map((row) => (
            <li key={row.workspaceId}>
              <span>{scopeNames.get(row.workspaceId) ?? "Scope"}</span>
              <span>
                {row.documentCount} / {row.cap}
              </span>
            </li>
          ))}
        </ul>
      )}

      {usageBytes != null && quotaBytes != null && (
        <div className="offline-storage-panel__browser">
          <GroupLabel>Browser storage for this site</GroupLabel>
          <p className="caption settings-field__hint">
            Includes offline documents, Ask history, and other Rhodes data saved
            in your browser — not your cloud library above.
          </p>
          <div className="offline-storage-panel__row">
            <div
              className={`offline-storage-panel__track${nearLimit ? " offline-storage-panel__track--warn" : ""}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ratio != null ? Math.round(ratio * 100) : 0}
              aria-label="Browser storage used by Rhodes on this device"
            >
              <div
                className="offline-storage-panel__fill"
                style={{
                  width: `${Math.max((ratio ?? 0) * 100, ratio != null && ratio > 0 ? 2 : 0)}%`,
                }}
              />
            </div>
            <p className="caption offline-storage-panel__meta">
              {formatLibraryFileSize(usageBytes)} used
              {quotaBytes > 0
                ? ` · ${formatLibraryFileSize(Math.max(0, quotaBytes - usageBytes))} free / ${formatLibraryFileSize(quotaBytes)}`
                : ""}
            </p>
          </div>
        </div>
      )}

      <p className="caption settings-field__hint">
        Use <strong>Clear offline cache</strong> when you want to remove local
        copies or free browser space. Rhodes re-downloads documents when you open
        them again.
      </p>

      <Button
        variant="secondary"
        loading={clearing}
        onClick={() => void handleClear()}
      >
        Clear offline cache
      </Button>
    </div>
  );
}
