import type { LibraryEmbeddingStatus, LibrarySourceRecord } from "@/lib/library/schemas";

export function toLibrarySourceRecord(
  row: Record<string, unknown>,
): LibrarySourceRecord | null {
  if (typeof row.id !== "string" || typeof row.workspace_id !== "string") {
    return null;
  }

  const status = row.embedding_status;
  const embedding_status: LibraryEmbeddingStatus =
    status === "pending" ||
    status === "processing" ||
    status === "ready" ||
    status === "failed"
      ? status
      : "pending";

  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as LibrarySourceRecord["metadata"])
      : null;

  return {
    id: row.id,
    workspace_id: row.workspace_id,
    uploaded_by:
      typeof row.uploaded_by === "string" ? row.uploaded_by : null,
    file_name: typeof row.file_name === "string" ? row.file_name : "Untitled",
    file_path: typeof row.file_path === "string" ? row.file_path : "",
    file_type: typeof row.file_type === "string" ? row.file_type : null,
    summary: typeof row.summary === "string" ? row.summary : null,
    embedding_status,
    metadata,
    created_at:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
  };
}

export function upsertLibrarySource(
  sources: LibrarySourceRecord[],
  next: LibrarySourceRecord,
): LibrarySourceRecord[] {
  const index = sources.findIndex((source) => source.id === next.id);
  if (index === -1) {
    return [next, ...sources].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  const copy = [...sources];
  copy[index] = { ...copy[index], ...next };
  return copy;
}
