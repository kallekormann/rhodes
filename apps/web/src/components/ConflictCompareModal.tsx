"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { ConflictReviewText } from "@/components/ConflictReviewText";
import { conflictComparePanes } from "@/lib/offline/conflict-compare-panes";
import type { BlockReviewModel } from "@/lib/offline/base-aligned-review";
import { reviewForBlock } from "@/lib/offline/base-aligned-review";
import type { ConflictReviewColors } from "@/lib/offline/conflict-review-colors";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";
import "./ConflictCompareModal.css";

type ConflictCompareModalProps = {
  cluster: SpanConflictCluster | null;
  reviews: BlockReviewModel[];
  colors: ConflictReviewColors;
  open: boolean;
  onClose: () => void;
  onKeep: () => void;
  onDismiss: () => void;
};

function ComparePane({
  label,
  segments,
  variant,
  colors,
  activeClusterId,
  scrollRef,
  onScroll,
}: {
  label: string;
  segments: BlockReviewModel["mineSegments"];
  variant: "mine" | "peer";
  colors: ConflictReviewColors;
  activeClusterId: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
}) {
  return (
    <section className="conflict-compare-modal__pane">
      <h3 className="conflict-compare-modal__pane-label">{label}</h3>
      <div
        ref={scrollRef}
        className="conflict-compare-modal__scroll"
        onScroll={onScroll}
      >
        <div className="conflict-compare-modal__body">
          <ConflictReviewText
            segments={segments}
            variant={variant}
            colors={colors}
            activeClusterId={activeClusterId}
          />
        </div>
      </div>
    </section>
  );
}

export function ConflictCompareModal({
  cluster,
  reviews,
  colors,
  open,
  onClose,
  onKeep,
  onDismiss,
}: ConflictCompareModalProps) {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const syncScroll = useCallback(
    (source: HTMLDivElement, target: HTMLDivElement | null) => {
      if (!target || syncingRef.current) return;
      syncingRef.current = true;
      target.scrollTop = source.scrollTop;
      target.scrollLeft = source.scrollLeft;
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    },
    [],
  );

  if (!open || !cluster) return null;

  const review = reviewForBlock(reviews, cluster.blockId);
  const panes = conflictComparePanes(cluster, review);

  return (
    <div className="conflict-compare-modal__backdrop" role="presentation">
      <div
        className="conflict-compare-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-compare-title"
      >
        <header className="conflict-compare-modal__header">
          <div>
            <p className="conflict-compare-modal__eyebrow">Sync conflict</p>
            <h2 id="conflict-compare-title" className="conflict-compare-modal__title">
              Compare versions
            </h2>
            <p className="conflict-compare-modal__hint">
              {panes.mine.changeHint}
            </p>
          </div>
          <Button size="small" variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </header>

        <div className="conflict-compare-modal__columns">
          <ComparePane
            label={panes.mine.label}
            segments={panes.mine.segments}
            variant={panes.mine.variant}
            colors={colors}
            activeClusterId={cluster.id}
            scrollRef={leftScrollRef}
            onScroll={(event) =>
              syncScroll(event.currentTarget, rightScrollRef.current)
            }
          />
          <ComparePane
            label={panes.theirs.label}
            segments={panes.theirs.segments}
            variant={panes.theirs.variant}
            colors={colors}
            activeClusterId={cluster.id}
            scrollRef={rightScrollRef}
            onScroll={(event) =>
              syncScroll(event.currentTarget, leftScrollRef.current)
            }
          />
        </div>

        <footer className="conflict-compare-modal__actions">
          <Button size="small" variant="secondary" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button size="small" variant="primary" onClick={onKeep}>
            Keep
          </Button>
        </footer>
      </div>
    </div>
  );
}
