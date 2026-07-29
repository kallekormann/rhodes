import type { DocumentRecord } from "@/hooks/useDocument";
import { documentMetadataEtag } from "@/lib/documents/document-etag";

export type FetchDocumentMetadataResult =
  | { kind: "ok"; document: DocumentRecord }
  | { kind: "not_modified" }
  | { kind: "error"; status?: number };

type FetchDocumentMetadataOptions = {
  ifNoneMatchUpdatedAt?: string | null;
  signal?: AbortSignal;
};

export async function fetchDocumentMetadata(
  documentId: string,
  options?: FetchDocumentMetadataOptions,
): Promise<FetchDocumentMetadataResult> {
  const headers: HeadersInit = {};
  if (options?.ifNoneMatchUpdatedAt) {
    headers["If-None-Match"] = documentMetadataEtag(options.ifNoneMatchUpdatedAt);
  }

  try {
    const response = await fetch(`/app/api/documents/${documentId}`, {
      headers,
      signal: options?.signal,
    });

    if (response.status === 304) {
      return { kind: "not_modified" };
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { kind: "error", status: response.status };
    }

    const document = data.document as DocumentRecord | undefined;
    if (!document) {
      return { kind: "error", status: response.status };
    }

    return { kind: "ok", document };
  } catch {
    return { kind: "error" };
  }
}
