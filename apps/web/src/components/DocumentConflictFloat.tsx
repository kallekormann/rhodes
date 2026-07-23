"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";
import "@/components/CommentsTab.css";
import "./DocumentConflictFloat.css";

type DocumentConflictFloatProps = {
  clusters: SpanConflictCluster[];
  activeClusterId: string | null;
  onActiveClusterChange: (clusterId: string) => void;
  onShowConflict: (cluster: SpanConflictCluster) => void;
  onKeep: (clusterId: string) => void;
  onDismiss: (clusterId: string) => void;
};

export function DocumentConflictFloat({
  clusters,
  activeClusterId,
  onActiveClusterChange,
  onShowConflict,
  onKeep,
  onDismiss,
}: DocumentConflictFloatProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [clusters]);

  useEffect(() => {
    if (!activeClusterId) return;
    const index = clusters.findIndex((cluster) => cluster.id === activeClusterId);
    if (index >= 0) setActiveIndex(index);
  }, [activeClusterId, clusters]);

  const active =
    clusters.length > 0
      ? clusters[Math.min(activeIndex, clusters.length - 1)]
      : null;

  useEffect(() => {
    if (active) onActiveClusterChange(active.id);
  }, [active, onActiveClusterChange]);

  const goToIndex = useCallback(
    (index: number) => {
      if (clusters.length === 0) return;
      const next = ((index % clusters.length) + clusters.length) % clusters.length;
      setActiveIndex(next);
      const cluster = clusters[next];
      if (cluster) onActiveClusterChange(cluster.id);
    },
    [clusters, onActiveClusterChange],
  );

  const handleShow = useCallback(() => {
    if (!active) return;
    onShowConflict(active);
  }, [active, onShowConflict]);

  const handleKeep = useCallback(() => {
    if (!active) return;
    onKeep(active.id);
    if (clusters.length > 1) {
      setActiveIndex((index) => Math.min(index, clusters.length - 2));
    }
  }, [active, clusters.length, onKeep]);

  const handleDismiss = useCallback(() => {
    if (!active) return;
    onDismiss(active.id);
    if (clusters.length > 1) {
      setActiveIndex((index) => Math.min(index, clusters.length - 2));
    }
  }, [active, clusters.length, onDismiss]);

  if (!active) return null;

  const position = Math.min(activeIndex, clusters.length - 1) + 1;
  const message =
    clusters.length === 1
      ? "1 conflicting change needs your decision."
      : `${clusters.length} conflicting changes need your decision.`;

  return (
    <aside
      className="document-conflict-float"
      role="status"
      aria-live="polite"
      aria-label="Offline sync conflict"
    >
      <article className="comments-tab__card comments-tab__card--selected document-conflict-float__card">
        <div className="comments-tab__thread">
          <div className="comments-tab__message">
            <header className="comments-tab__message-header">
              <div className="comments-tab__message-identity">
                <div className="comments-tab__message-meta">
                  <span className="comments-tab__message-author">Sync conflict</span>
                  {clusters.length > 1 && (
                    <span className="comments-tab__message-date">
                      {position} of {clusters.length}
                    </span>
                  )}
                </div>
              </div>
            </header>
            <p className="comments-tab__message-text">{message}</p>
          </div>
        </div>

        <div className="comments-tab__card-footer document-conflict-float__footer">
          {clusters.length > 1 && (
            <Button
              type="button"
              size="small"
              variant="ghost"
              className="document-conflict-float__btn-next"
              onClick={() => goToIndex(activeIndex + 1)}
            >
              Next
            </Button>
          )}
          <Button type="button" size="small" variant="ghost" onClick={handleShow}>
            Show me
          </Button>
          <Button
            type="button"
            size="small"
            variant="secondary"
            onClick={handleDismiss}
            title="Use the online version from other editors"
          >
            Dismiss
          </Button>
          <Button
            type="button"
            size="small"
            variant="primary"
            onClick={handleKeep}
            title="Keep your offline version"
          >
            Keep
          </Button>
        </div>
      </article>
    </aside>
  );
}
