import type { DocumentActivityEventType, DocumentActivityRecord } from "./activity";
import { formatActivityPayloadDetail } from "./activity-content";

export type EnrichedActivityRecord = DocumentActivityRecord & {
  actor_display_name: string | null;
  actor_avatar_url: string | null;
};

export function formatActivityTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatActivityDetail(
  eventType: DocumentActivityEventType,
  payload: Record<string, unknown>,
): string | null {
  return formatActivityPayloadDetail(eventType, payload);
}

export function activityActionLabel(eventType: DocumentActivityEventType): string {
  switch (eventType) {
    case "comment_added":
      return "added a comment";
    case "comment_removed":
      return "removed a comment";
    case "property_changed":
      return "changed a property";
    case "title_changed":
      return "renamed the document";
    case "content_edited":
      return "edited the document";
    case "version_restored":
      return "restored a version";
    case "shared_with":
      return "shared the document";
    case "share_removed":
      return "removed a share";
    default:
      return "updated the document";
  }
}
