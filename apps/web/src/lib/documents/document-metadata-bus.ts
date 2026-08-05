/**
 * Broadcast metadata changes made outside the open editor session
 * (e.g. Wiki tree reparent via useDocuments) so Properties/Origin stay in sync.
 */

export const DOCUMENT_METADATA_PATCHED_EVENT =
  "rhodes:document-metadata-patched";

export type DocumentMetadataPatchedDetail = {
  documentId: string;
  metadata: Record<string, unknown> | null;
  updated_at?: string;
};

export function notifyDocumentMetadataPatched(
  detail: DocumentMetadataPatchedDetail,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DocumentMetadataPatchedDetail>(
      DOCUMENT_METADATA_PATCHED_EVENT,
      { detail },
    ),
  );
}
