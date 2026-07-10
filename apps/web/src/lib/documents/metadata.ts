export type DocumentMetadata = {
  favorite?: boolean;
  archived?: boolean;
  archived_at?: string | null;
};

export type ShareGrantee = {
  kind: "user" | "workspace";
  id: string;
  label: string;
};

export function readDocumentMetadata(
  metadata: Record<string, unknown> | null | undefined,
): DocumentMetadata {
  if (!metadata) return {};
  return {
    favorite: metadata.favorite === true,
    archived: metadata.archived === true,
    archived_at:
      typeof metadata.archived_at === "string" ? metadata.archived_at : null,
  };
}

export function isDocumentFavorite(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return readDocumentMetadata(metadata).favorite === true;
}

export function isDocumentArchived(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return readDocumentMetadata(metadata).archived === true;
}

export function withFavorite(
  metadata: Record<string, unknown> | null | undefined,
  favorite: boolean,
): Record<string, unknown> {
  return { ...(metadata ?? {}), favorite };
}

export function withArchived(
  metadata: Record<string, unknown> | null | undefined,
  archived: boolean,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    archived,
    archived_at: archived ? new Date().toISOString() : null,
  };
}
