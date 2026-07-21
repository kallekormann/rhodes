export function isLibraryOrigin(originType: string | null | undefined): boolean {
  return originType === "source_chunk" || originType === "library";
}

export function isDocumentOrigin(originType: string | null | undefined): boolean {
  return (
    originType === "document" ||
    originType === "document_chunk" ||
    originType === "workspace_document"
  );
}

export function libraryServeUrl(sourceRefId: string, page?: number | null): string {
  const base = `/app/api/library/${encodeURIComponent(sourceRefId)}/serve`;
  if (page == null) return base;
  return `${base}#page=${page}`;
}

export function documentEditorUrl(documentId: string): string {
  return `/app/editor?doc=${encodeURIComponent(documentId)}`;
}

export function knowledgeSourcePreviewUrl(input: {
  originType: string;
  sourceRefId: string;
  page?: number | null;
}): string {
  if (isLibraryOrigin(input.originType)) {
    return libraryServeUrl(input.sourceRefId, input.page);
  }
  return documentEditorUrl(input.sourceRefId);
}

export function openKnowledgeSourcePreview(input: {
  originType: string;
  sourceRefId: string;
  page?: number | null;
}): void {
  const url = knowledgeSourcePreviewUrl(input);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function citationPreviewInput(attrs: {
  originType?: string | null;
  sourceRefId?: string | null;
  sourceId?: string | null;
  page?: number | null;
}): { originType: string; sourceRefId: string; page: number | null } | null {
  const sourceRefId = String(attrs.sourceRefId ?? attrs.sourceId ?? "").trim();
  if (!sourceRefId) return null;

  return {
    originType: attrs.originType ?? "source_chunk",
    sourceRefId,
    page: typeof attrs.page === "number" ? attrs.page : null,
  };
}
