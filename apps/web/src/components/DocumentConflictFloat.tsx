"use client";

import { useCallback, useMemo } from "react";
import { Button } from "@/components/Button";
import {
  clusterReviewSummary,
  reviewForBlock,
  type BlockReviewModel,
} from "@/lib/offline/base-aligned-review";
import { collaborationColorForUser } from "@/lib/offline/conflict-review-colors";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";
import "@/components/CommentsTab.css";
import "./DocumentConflictFloat.css";

type DocumentConflictFloatProps = {
  clusters: SpanConflictCluster[];
  reviews: BlockReviewModel[];
  activeClusterId: string | null;
  onActiveClusterChange: (clusterId: string) => void;
  onShowConflict: (cluster: SpanConflictCluster) => void;
  onKeep: (clusterId: string) => void;
  onDismiss: (clusterId: string) => void;
};

export function DocumentConflictFloat({
  clusters,
  reviews,
  activeClusterId,
  onActiveClusterChange,
  onShowConflict,
  onKeep,
  onDismiss,
}: DocumentConflictFloatProps) {
  const activeIndex = useMemo(() => {
    if (clusters.length === 0) return -1;
    if (!activeClusterId) return 0;
    const index = clusters.findIndex((cluster) => cluster.id === activeClusterId);
    return index >= 0 ? index : 0;
  }, [activeClusterId, clusters]);

  const active =
    activeIndex >= 0 ? clusters[activeIndex] ?? null : null;

  const goToIndex = useCallback(
    (index: number) => {
      if (clusters.length === 0) return;
      const next = ((index % clusters.length) + clusters.length) % clusters.length;
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
  }, [active, onKeep]);

  const handleDismiss = useCallback(() => {
    if (!active) return;
    onDismiss(active.id);
  }, [active, onDismiss]);

  const clusterSummary = useMemo(() => {
    if (!active) return null;
    const review = reviewForBlock(reviews, active.blockId);
    if (!review) return null;
    return clusterReviewSummary(review, active.id);
  }, [active, reviews]);

  const peerLegend = useMemo(() => {
    if (!active) return [];
    const review = reviewForBlock(reviews, active.blockId);
    return review?.peerContributors ?? [];
  }, [active, reviews]);

  if (!active) return null;

  const position = activeIndex + 1;
  const message =
    clusterSummary ??
    (clusters.length === 1
      ? "1 section needs your decision."
      : `${clusters.length} sections need your decision.`);

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
            {peerLegend.length > 0 && (
              <ul className="document-conflict-float__legend" aria-label="Other editors">
                {peerLegend.map((peer) => (
                  <li key={peer.userId}>
                    <span
                      className="document-conflict-float__legend-swatch"
                      style={{ backgroundColor: collaborationColorForUser(peer.userId) }}
                      aria-hidden="true"
                    />
                    {peer.displayName}
                  </li>
                ))}
              </ul>
            )}
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
