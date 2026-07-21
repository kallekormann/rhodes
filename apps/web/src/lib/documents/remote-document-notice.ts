import {
  activityActionLabel,
  formatActivityDetail,
  type EnrichedActivityRecord,
} from "@/lib/documents/activity-display";
import type { DocumentActivityEventType } from "@/lib/documents/activity";

export type DocumentRemoteNotice = {
  updatedAt: string;
  actorId: string | null;
  actorLabel: string;
  actionLabel: string;
  detail: string | null;
};

const SUMMARY_ACTOR_PATTERNS = [
  /^(.+?) added a comment$/,
  /^(.+?) removed a comment$/,
  /^(.+?) changed /,
  /^(.+?) renamed document to /,
  /^(.+?) edited the document$/,
  /^(.+?) restored a previous version$/,
  /^(.+?) shared with /,
  /^(.+?) removed share for /,
  /^(.+?) updated the document$/,
] as const;

function parseActorNameFromActivitySummary(
  summary: string | null | undefined,
): string | null {
  const trimmed = summary?.trim();
  if (!trimmed) return null;

  for (const pattern of SUMMARY_ACTOR_PATTERNS) {
    const match = trimmed.match(pattern);
    const who = match?.[1]?.trim();
    if (who && who !== "Someone") return who;
  }

  return null;
}

export function resolveActivityActorLabel(entry: EnrichedActivityRecord): string {
  const fromApi = entry.actor_display_name?.trim();
  if (fromApi) return fromApi;

  const payload =
    entry.payload && typeof entry.payload === "object"
      ? (entry.payload as Record<string, unknown>)
      : {};

  const fromPayload =
    typeof payload.actor_display_name === "string"
      ? payload.actor_display_name.trim()
      : "";
  if (fromPayload && fromPayload !== "Someone") return fromPayload;

  const fromSummary = parseActorNameFromActivitySummary(entry.summary);
  if (fromSummary) return fromSummary;

  return "A collaborator";
}

export function mapActivityToRemoteNotice(
  entry: EnrichedActivityRecord,
): DocumentRemoteNotice {
  const payload =
    entry.payload && typeof entry.payload === "object"
      ? (entry.payload as Record<string, unknown>)
      : {};

  const detail = formatActivityDetail(
    entry.event_type as DocumentActivityEventType,
    payload,
  );

  return {
    updatedAt: entry.created_at,
    actorId: entry.actor_id,
    actorLabel: resolveActivityActorLabel(entry),
    actionLabel: activityActionLabel(entry.event_type as DocumentActivityEventType),
    detail: detail?.trim() || null,
  };
}

/** Latest activity after `sinceUpdatedAt`; null if none or last change was by `currentUserId`. */
export function pickLatestOtherActivitySince(
  entries: EnrichedActivityRecord[],
  sinceUpdatedAt: string,
  currentUserId: string,
): EnrichedActivityRecord | null {
  const sinceTime = new Date(sinceUpdatedAt).getTime();
  if (Number.isNaN(sinceTime)) return null;

  const recent = entries.filter(
    (entry) => new Date(entry.created_at).getTime() > sinceTime,
  );
  if (recent.length === 0) return null;

  const latest = recent[0];
  if (!latest.actor_id || latest.actor_id === currentUserId) return null;
  return latest;
}

/** Most recent activity row if it belongs to someone other than `currentUserId`. */
export function pickLatestOtherActivity(
  entries: EnrichedActivityRecord[],
  currentUserId: string,
): EnrichedActivityRecord | null {
  const latest = entries[0];
  if (!latest?.actor_id || latest.actor_id === currentUserId) return null;
  return latest;
}

export function formatRemoteNoticeDetail(
  notice: Pick<DocumentRemoteNotice, "detail">,
): string | null {
  return notice.detail?.trim() || null;
}
