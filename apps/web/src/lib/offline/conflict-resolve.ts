/**
 * Keep mine / Take theirs resolution for document conflicts (Wave B).
 */

import type { DocumentRecord } from "@/hooks/useDocument";
import {
  putOfflineDocument,
  setOfflineDocumentStatus,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { clearOutboxForDocument } from "@/lib/offline/outbox";
import {
  clearConflictServerDocument,
  storeConflictServerDocument,
} from "@/lib/offline/conflict-store";

export async function saveConflictVersionBranch(params: {
  documentId: string;
  content: Record<string, unknown> | null;
  contentPlain: string | null;
  changeSummary: string;
}): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(
    `/app/api/documents/${params.documentId}/versions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        change_summary: params.changeSummary,
        content: params.content,
        content_plain: params.contentPlain,
      }),
    },
  );
  if (response.ok || response.status === 201) return { ok: true };
  const data = await response.json().catch(() => ({}));
  return {
    ok: false,
    error:
      typeof data.error === "string"
        ? data.error
        : "Could not save conflict version",
  };
}

/** Push local content over the known server version (after branching theirs). */
export async function forcePushMine(params: {
  documentId: string;
  mine: {
    title: string;
    content: Record<string, unknown> | null;
    content_plain: string | null;
    metadata?: Record<string, unknown> | null;
  };
  expectedUpdatedAt: string;
  workspaceId: string;
  createdAt: string;
}): Promise<{ ok: boolean; document?: DocumentRecord; error?: string }> {
  await clearOutboxForDocument(params.documentId);

  const response = await fetch(`/app/api/documents/${params.documentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: params.mine.title,
      content: params.mine.content ?? undefined,
      content_plain: params.mine.content_plain ?? undefined,
      metadata: params.mine.metadata ?? undefined,
      expected_updated_at: params.expectedUpdatedAt,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error:
        typeof data.error === "string" ? data.error : "Could not keep your version",
    };
  }

  const document = data.document as DocumentRecord;
  await putOfflineDocument(
    toOfflineDocumentRecord({
      ...document,
      server_updated_at: document.updated_at,
      sync_status: "synced",
    }),
  );
  await clearConflictServerDocument(params.documentId);
  return { ok: true, document };
}

export async function applyTakeTheirs(params: {
  documentId: string;
  theirs: DocumentRecord;
}): Promise<void> {
  await clearOutboxForDocument(params.documentId);
  await putOfflineDocument(
    toOfflineDocumentRecord({
      ...params.theirs,
      server_updated_at: params.theirs.updated_at,
      sync_status: "synced",
    }),
  );
  await clearConflictServerDocument(params.documentId);
}

export async function rememberConflictTheirs(
  documentId: string,
  theirs: DocumentRecord | Record<string, unknown>,
): Promise<void> {
  await storeConflictServerDocument(documentId, theirs);
  await setOfflineDocumentStatus(documentId, "conflict");
}
