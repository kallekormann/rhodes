"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { LoaderState } from "@/components/Loader";
import { useDocumentActivity, useDocumentVersions } from "@/hooks/useDocumentActivity";
import {
  activityActionLabel,
  formatActivityDetail,
  formatActivityTimestamp,
  type EnrichedActivityRecord,
} from "@/lib/documents/activity-display";
import type { DocumentActivityEventType } from "@/lib/documents/activity";
import { UserAvatar } from "@/components/UserAvatar";
import "./DocumentHistorySection.css";

export type ActivityNavigateTarget = {
  eventType: DocumentActivityEventType;
  payload: Record<string, unknown>;
};

type DocumentHistorySectionProps = {
  documentId: string | null;
  onVersionRestored?: () => void;
  onNavigateToActivity?: (target: ActivityNavigateTarget) => void;
};

function readPayload(entry: EnrichedActivityRecord): Record<string, unknown> {
  return entry.payload && typeof entry.payload === "object"
    ? (entry.payload as Record<string, unknown>)
    : {};
}

function isNavigableActivity(
  eventType: DocumentActivityEventType,
  payload: Record<string, unknown>,
): boolean {
  if (eventType !== "content_edited") return false;
  return typeof payload.excerpt === "string" && payload.excerpt.trim().length > 0;
}

function ActivityTimelineItem({
  entry,
  onNavigateToActivity,
}: {
  entry: EnrichedActivityRecord;
  onNavigateToActivity?: (target: ActivityNavigateTarget) => void;
}) {
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventType = entry.event_type as DocumentActivityEventType;
  const payload = readPayload(entry);
  const actor = entry.actor_display_name?.trim() || "Someone";
  const action = activityActionLabel(eventType);
  const detail = formatActivityDetail(eventType, payload);
  const navigable = isNavigableActivity(eventType, payload);

  const navigate = () => {
    if (!navigable || !onNavigateToActivity) return;
    onNavigateToActivity({ eventType, payload });
  };

  const handleMouseEnter = () => {
    if (!navigable || !onNavigateToActivity) return;
    hoverTimerRef.current = setTimeout(navigate, 280);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  return (
    <li
      className={`activity-timeline__item${navigable ? " activity-timeline__item--navigable" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={navigate}
      onKeyDown={(event) => {
        if (!navigable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate();
        }
      }}
      tabIndex={navigable ? 0 : undefined}
      role={navigable ? "button" : undefined}
      aria-label={
        navigable && detail ? `Jump to edit: ${detail}` : undefined
      }
    >
      <UserAvatar
        name={actor}
        userId={entry.actor_id ?? undefined}
        src={entry.actor_avatar_url}
        size="sm"
        className="activity-timeline__avatar"
      />
      <div className="activity-timeline__content">
        <p className="activity-timeline__summary">
          <span className="activity-timeline__actor">{actor}</span>{" "}
          <span className="activity-timeline__action">{action}</span>
        </p>
        {detail && <p className="activity-timeline__detail">{detail}</p>}
        <time className="activity-timeline__time" dateTime={entry.created_at}>
          {formatActivityTimestamp(entry.created_at)}
        </time>
      </div>
    </li>
  );
}

export function DocumentHistorySection({
  documentId,
  onVersionRestored,
  onNavigateToActivity,
}: DocumentHistorySectionProps) {
  const { activity, loading: activityLoading } = useDocumentActivity(documentId);
  const {
    versions,
    loading: versionsLoading,
    restoreVersion,
  } = useDocumentVersions(documentId);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  if (!documentId) return null;

  return (
    <section className="document-history" aria-label="Document history">
      <header className="document-history__header">
        <h3 className="props-list__section-title">Activity</h3>
      </header>

      {activityLoading ? (
        <LoaderState label="Loading activity…" />
      ) : activity.length === 0 ? (
        <p className="caption property-panel__empty">No activity yet.</p>
      ) : (
        <ol className="activity-timeline">
          {activity.map((entry) => (
            <ActivityTimelineItem
              key={entry.id}
              entry={entry}
              onNavigateToActivity={onNavigateToActivity}
            />
          ))}
        </ol>
      )}

      <header className="document-history__header document-history__header--versions">
        <h3 className="props-list__section-title">Versions</h3>
      </header>

      {versionsLoading ? (
        <LoaderState label="Loading versions…" />
      ) : versions.length === 0 ? (
        <p className="caption property-panel__empty">No saved versions yet.</p>
      ) : (
        <ul className="document-history__version-list">
          {versions.map((version) => (
            <li key={version.id} className="document-history__version-item">
              <div className="document-history__version-copy">
                <p className="document-history__version-label">
                  {version.change_summary?.trim() || "Snapshot"}
                </p>
                <time className="document-history__version-time" dateTime={version.created_at}>
                  {formatActivityTimestamp(version.created_at)}
                </time>
              </div>
              <Button
                variant="secondary"
                size="small"
                disabled={restoringId === version.id}
                onClick={() => {
                  setRestoringId(version.id);
                  void restoreVersion(version.id).then((restored) => {
                    setRestoringId(null);
                    if (restored) onVersionRestored?.();
                  });
                }}
              >
                {restoringId === version.id ? "Restoring…" : "Restore"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
