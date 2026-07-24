"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { ConflictDiffText } from "@/components/ConflictDiffText";
import { conflictComparePanes } from "@/lib/offline/conflict-compare-panes";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";
import "./ConflictCompareModal.css";

type ConflictCompareModalProps = {
  cluster: SpanConflictCluster | null;
  open: boolean;
  onClose: () => void;
  onKeep: () => void;
  onDismiss: () => void;
};

function ComparePane({
  label,
  otherText,
  text,
  variant,
  scrollRef,
  onScroll,
}: {
  label: string;
  otherText: string;
  text: string;
  variant: "mine" | "theirs";
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
          <ConflictDiffText otherText={otherText} text={text} variant={variant} />
        </div>
      </div>
    </section>
  );
}

export function ConflictCompareModal({
  cluster,
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

  const panes = conflictComparePanes(cluster);

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
              Conflicting change:{" "}
              <span className="conflict-compare-modal__change">
                {panes.mine.changeHint}
              </span>
            </p>
          </div>
          <Button size="small" variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </header>

        <div className="conflict-compare-modal__columns">
          <ComparePane
            label={panes.mine.label}
            otherText={panes.mine.otherText}
            text={panes.mine.text}
            variant={panes.mine.variant}
            scrollRef={leftScrollRef}
            onScroll={(event) =>
              syncScroll(event.currentTarget, rightScrollRef.current)
            }
          />
          <ComparePane
            label={panes.theirs.label}
            otherText={panes.theirs.otherText}
            text={panes.theirs.text}
            variant={panes.theirs.variant}
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
