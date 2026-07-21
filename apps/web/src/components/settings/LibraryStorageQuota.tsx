"use client";

import { useEffect, useState } from "react";
import { formatLibraryFileSize } from "@/lib/library/format";
import "./LibraryStorageQuota.css";

type QuotaBreakdownItem = {
  workspace_id: string;
  name: string;
  used_bytes: number;
};

type QuotaPayload = {
  used_bytes: number;
  limit_bytes: number;
  max_file_bytes: number;
  tier: string;
  owned_workspace_count: number;
  breakdown: QuotaBreakdownItem[];
};

export function LibraryStorageQuota() {
  const [quota, setQuota] = useState<QuotaPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/app/api/account/library-quota");
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Failed to load quota",
          );
        }
        if (!cancelled) setQuota(data as QuotaPayload);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load quota");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="caption settings-field__hint">Loading storage…</p>;
  }

  if (error || !quota) {
    return (
      <p className="caption settings-field__hint">
        {error ?? "Storage quota unavailable."}
      </p>
    );
  }

  const free = Math.max(0, quota.limit_bytes - quota.used_bytes);
  const ratio =
    quota.limit_bytes > 0
      ? Math.min(1, quota.used_bytes / quota.limit_bytes)
      : 0;
  const nearLimit = ratio >= 0.9;

  return (
    <div className="library-storage-quota">
      <div className="library-storage-quota__row">
        <div
          className={`library-storage-quota__track${nearLimit ? " library-storage-quota__track--warn" : ""}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          aria-label="Library storage used"
        >
          <div
            className="library-storage-quota__fill"
            style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 2 : 0)}%` }}
          />
        </div>
        <p className="caption library-storage-quota__meta">
          {formatLibraryFileSize(quota.used_bytes)} used ·{" "}
          {formatLibraryFileSize(free)} free /{" "}
          {formatLibraryFileSize(quota.limit_bytes)}
        </p>
      </div>
      <p className="caption settings-field__hint">
        Across all scopes you own. Max file size:{" "}
        {formatLibraryFileSize(quota.max_file_bytes)}.
      </p>
      {quota.breakdown.length > 1 && (
        <>
          <button
            type="button"
            className="library-storage-quota__toggle"
            onClick={() => setShowBreakdown((v) => !v)}
          >
            {showBreakdown ? "Hide breakdown" : "Show breakdown by scope"}
          </button>
          {showBreakdown && (
            <ul className="library-storage-quota__breakdown">
              {quota.breakdown.map((item) => (
                <li key={item.workspace_id}>
                  <span>{item.name}</span>
                  <span>{formatLibraryFileSize(item.used_bytes)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
