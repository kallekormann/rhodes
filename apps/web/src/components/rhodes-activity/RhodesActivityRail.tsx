"use client";

import { Lightbulb, PenLine, SlidersHorizontal } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { WritingCoachSuggestion } from "@/hooks/useWritingCoach";
import { RhodesActivityBubble } from "./RhodesActivityBubble";
import { WritingCoachPopover } from "./WritingCoachPopover";
import "./RhodesActivityRail.css";

export type RhodesActivityRailProps = {
  processing?: boolean;
  processingLabel?: string;
  insightCount?: number;
  propertiesNotice?: boolean;
  writingSuggestion?: WritingCoachSuggestion | null;
  writingOpen?: boolean;
  writingLoading?: boolean;
  onDismissProperties?: () => void;
  onToggleWriting?: () => void;
  onDismissWriting?: () => void;
  onAcceptWriting?: () => void;
};

export function RhodesActivityRail({
  processing = false,
  processingLabel = "Rhodes is working…",
  insightCount = 0,
  propertiesNotice = false,
  writingSuggestion = null,
  writingOpen = false,
  writingLoading = false,
  onDismissProperties,
  onToggleWriting,
  onDismissWriting,
  onAcceptWriting,
}: RhodesActivityRailProps) {
  const { openPanel } = useApp();

  const showInsights = insightCount > 0;
  const showProperties = propertiesNotice;
  const showWriting = writingSuggestion != null || writingLoading;

  if (!processing && !showInsights && !showProperties && !showWriting) {
    return null;
  }

  return (
    <div className="rhodes-activity-rail" aria-live="polite">
      {showWriting && (
        <div className="rhodes-activity-rail__item rhodes-activity-rail__item--writing">
          {writingOpen && writingSuggestion && (
            <WritingCoachPopover
              suggestion={writingSuggestion}
              onAccept={() => onAcceptWriting?.()}
              onDismiss={() => onDismissWriting?.()}
            />
          )}
          <RhodesActivityBubble
            variant="writing"
            icon={PenLine}
            label={
              writingLoading
                ? "Rhodes is reviewing your writing…"
                : "Rhodes has a writing suggestion"
            }
            active={writingOpen}
            onClick={() => onToggleWriting?.()}
          />
        </div>
      )}

      {showProperties && (
        <div className="rhodes-activity-rail__item">
          <RhodesActivityBubble
            variant="properties"
            icon={SlidersHorizontal}
            label="Rhodes filled properties"
            onClick={() => {
              onDismissProperties?.();
              openPanel("properties");
            }}
          />
        </div>
      )}

      {showInsights && (
        <div className="rhodes-activity-rail__item">
          <RhodesActivityBubble
            variant="insights"
            icon={Lightbulb}
            label="Related sources and documents"
            count={insightCount}
            onClick={() => openPanel("insights")}
          />
        </div>
      )}

      {processing && (
        <div className="rhodes-activity-rail__item">
          <RhodesActivityBubble
            variant="processing"
            label={processingLabel}
          />
        </div>
      )}
    </div>
  );
}
