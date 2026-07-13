export type DocumentActivityEventType =
  | "comment_added"
  | "comment_removed"
  | "property_changed"
  | "title_changed"
  | "content_edited"
  | "version_restored"
  | "shared_with"
  | "share_removed";

export type DocumentActivityRecord = {
  id: string;
  document_id: string;
  workspace_id: string;
  actor_id: string | null;
  event_type: DocumentActivityEventType;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type RecordDocumentActivityInput = {
  documentId: string;
  workspaceId: string;
  actorId: string;
  actorDisplayName: string;
  eventType: DocumentActivityEventType;
  payload?: Record<string, unknown>;
};

function buildSummary(
  eventType: DocumentActivityEventType,
  actorDisplayName: string,
  payload: Record<string, unknown>,
): string {
  const who = actorDisplayName.trim() || "Someone";

  switch (eventType) {
    case "comment_added":
      return `${who} added a comment`;
    case "comment_removed":
      return `${who} removed a comment`;
    case "property_changed": {
      const label =
        typeof payload.field_label === "string" ? payload.field_label : "a property";
      const from = payload.from;
      const to = payload.to;
      if (from !== undefined && to !== undefined) {
        return `${who} changed ${label} from ${String(from)} to ${String(to)}`;
      }
      return `${who} changed ${label}`;
    }
    case "title_changed": {
      const title = typeof payload.title === "string" ? payload.title : "the document";
      return `${who} renamed document to "${title}"`;
    }
    case "content_edited":
      return `${who} edited the document`;
    case "version_restored":
      return `${who} restored a previous version`;
    case "shared_with": {
      const target = typeof payload.target === "string" ? payload.target : "someone";
      return `${who} shared with ${target}`;
    }
    case "share_removed": {
      const target = typeof payload.target === "string" ? payload.target : "someone";
      return `${who} removed share for ${target}`;
    }
    default:
      return `${who} updated the document`;
  }
}

export async function recordDocumentActivity(
  supabase: {
    from: (table: string) => {
      insert: (
        row: Record<string, unknown>,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  },
  input: RecordDocumentActivityInput,
): Promise<void> {
  const payload = input.payload ?? {};
  const summary = buildSummary(input.eventType, input.actorDisplayName, payload);

  const { error } = await supabase.from("document_activity").insert({
    document_id: input.documentId,
    workspace_id: input.workspaceId,
    actor_id: input.actorId,
    event_type: input.eventType,
    summary,
    payload,
  });

  if (error) {
    console.error("document activity insert failed", error.message);
  }
}

const RESERVED_METADATA_DIFF_KEYS = new Set([
  "favorite",
  "archived",
  "archived_at",
  "template_draft",
  "comments",
  "template_description",
  "_ai_filled_keys",
  "word_count",
  "summary",
]);

function isTrackedMetadataKey(key: string): boolean {
  if (RESERVED_METADATA_DIFF_KEYS.has(key)) return false;
  if (key.startsWith("_")) return false;
  return true;
}

export function diffMetadataPropertyChanges(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
  labelByKey?: Map<string, string>,
): Array<{ fieldKey: string; fieldLabel: string; from: unknown; to: unknown }> {
  const prev = previous && typeof previous === "object" ? previous : {};
  const nxt = next && typeof next === "object" ? next : {};
  const keys = new Set([
    ...Object.keys(prev).filter(isTrackedMetadataKey),
    ...Object.keys(nxt).filter(isTrackedMetadataKey),
  ]);
  const changes: Array<{ fieldKey: string; fieldLabel: string; from: unknown; to: unknown }> = [];

  for (const key of keys) {
    const from = prev[key];
    const to = nxt[key];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    changes.push({
      fieldKey: key,
      fieldLabel:
        labelByKey?.get(key) ?? key.replace(/^user_/, "").replace(/_/g, " "),
      from: from ?? null,
      to: to ?? null,
    });
  }

  return changes;
}

export function diffCommentChanges(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): { added: number; removed: number; addedExcerpt: string | null } {
  const prevComments = Array.isArray(previous?.comments) ? previous.comments : [];
  const nextComments = Array.isArray(next?.comments) ? next.comments : [];
  const prevIds = new Set(
    prevComments
      .map((item) => (item && typeof item === "object" ? (item as { id?: string }).id : null))
      .filter((id): id is string => typeof id === "string"),
  );

  let added = 0;
  let removed = 0;
  let addedExcerpt: string | null = null;

  for (const item of nextComments) {
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: string; text?: string };
    if (typeof record.id !== "string" || prevIds.has(record.id)) continue;
    added += 1;
    if (!addedExcerpt && typeof record.text === "string") {
      addedExcerpt = record.text.slice(0, 120);
    }
  }

  for (const item of prevComments) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { id?: string }).id;
    if (typeof id === "string" && !nextComments.some(
      (nextItem) =>
        nextItem &&
        typeof nextItem === "object" &&
        (nextItem as { id?: string }).id === id,
    )) {
      removed += 1;
    }
  }

  return { added, removed, addedExcerpt };
}
