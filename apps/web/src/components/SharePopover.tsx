"use client";

import { Search, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import "./SharePopover.css";

export type SharePermission = "read" | "edit";

export type ShareTarget = {
  kind: "user" | "workspace";
  id: string;
  label: string;
  subtitle: string;
};

export type DocumentShareRecord = {
  id: string;
  grantee_type: "user" | "workspace";
  grantee_user_id: string | null;
  grantee_workspace_id: string | null;
  label: string;
  permission: SharePermission;
};

const permissionOptions = [
  { id: "edit", label: "Can edit" },
  { id: "read", label: "Can view" },
];

type SharePopoverProps = {
  documentId: string;
  onClose?: () => void;
  onSharesChange?: () => void;
};

export function SharePopover({ documentId, onClose, onSharesChange }: SharePopoverProps) {
  const [search, setSearch] = useState("");
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [shares, setShares] = useState<DocumentShareRecord[]>([]);
  const [newSharePermission, setNewSharePermission] = useState<SharePermission>("edit");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshShares = useCallback(async () => {
    const response = await fetch(`/app/api/documents/${documentId}/shares`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to load shares");
      return;
    }
    setShares((data.shares as DocumentShareRecord[]) ?? []);
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());

      const [targetsRes] = await Promise.all([
        fetch(`/app/api/share-targets?${params}`),
        refreshShares(),
      ]);

      const targetsData = await targetsRes.json().catch(() => ({}));
      if (!cancelled) {
        if (!targetsRes.ok) {
          setError(
            typeof targetsData.error === "string"
              ? targetsData.error
              : "Failed to load people and teams",
          );
        } else {
          setTargets((targetsData.targets as ShareTarget[]) ?? []);
        }
        setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [search, refreshShares]);

  const addShare = async (target: ShareTarget) => {
    setError(null);
    const response = await fetch(`/app/api/documents/${documentId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grantee_type: target.kind,
        grantee_id: target.id,
        permission: newSharePermission,
        label:
          target.kind === "user" && target.subtitle
            ? `${target.label} (${target.subtitle})`
            : target.label,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Share failed");
      return;
    }
    await refreshShares();
    onSharesChange?.();
    setSearch("");
  };

  const updateSharePermission = async (shareId: string, permission: SharePermission) => {
    setError(null);
    const response = await fetch(`/app/api/documents/${documentId}/shares`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share_id: shareId, permission }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't update permission");
      return;
    }
    await refreshShares();
    onSharesChange?.();
  };

  const removeShare = async (shareId: string) => {
    const response = await fetch(
      `/app/api/documents/${documentId}/shares?share_id=${encodeURIComponent(shareId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Remove failed");
      return;
    }
    await refreshShares();
    onSharesChange?.();
  };

  const sharedIds = new Set(
    shares.map((share) => share.grantee_user_id ?? share.grantee_workspace_id),
  );

  return (
    <div className="share-popover" role="dialog" aria-label="Share document">
      <div className="share-popover__header">
        <h3 className="share-popover__title">Share with</h3>
        {onClose && (
          <button type="button" className="share-popover__close" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <Input
        value={search}
        onChange={setSearch}
        placeholder="Search scope, name, or email…"
        icon={<Search size={15} strokeWidth={1.75} />}
        aria-label="Search share targets"
      />

      <div className="share-popover__permission-field">
        <label className="share-popover__section-label" htmlFor="share-permission">
          Permission for new shares
        </label>
        <Dropdown
          variant="field"
          value={newSharePermission}
          options={permissionOptions}
          onChange={(value) => setNewSharePermission(value as SharePermission)}
        />
      </div>

      {error && <p className="share-popover__error caption">{error}</p>}

      {shares.length > 0 && (
        <section className="share-popover__section">
          <header className="share-popover__section-label">Shared with</header>
          <ul className="share-popover__list">
            {shares.map((share) => (
              <li key={share.id} className="share-popover__shared-item">
                <span className="share-popover__shared-label">{share.label}</span>
                <div className="share-popover__shared-actions">
                  <Dropdown
                    variant="plain"
                    value={share.permission ?? "edit"}
                    options={permissionOptions}
                    onChange={(value) =>
                      void updateSharePermission(share.id, value as SharePermission)
                    }
                  />
                  <button
                    type="button"
                    className="share-popover__remove"
                    onClick={() => void removeShare(share.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="share-popover__section">
        <header className="share-popover__section-label">Suggestions</header>
        {loading ? (
          <p className="share-popover__empty caption">Loading…</p>
        ) : targets.length === 0 ? (
          <p className="share-popover__empty caption">
            No matches found. You can share with scopes you belong to and people who share a
            team scope with you.
          </p>
        ) : (
          <ul className="share-popover__list">
            {targets
              .filter((target) => !sharedIds.has(target.id))
              .map((target) => (
                <li key={`${target.kind}:${target.id}`}>
                  <button
                    type="button"
                    className="share-popover__item"
                    onClick={() => void addShare(target)}
                  >
                    <Users size={15} strokeWidth={1.75} />
                    <span className="share-popover__item-main">
                      <span className="share-popover__item-label">{target.label}</span>
                      <span className="share-popover__item-subtitle">{target.subtitle}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
