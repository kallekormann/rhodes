/**
 * TEMP (TD-004): Remove after offline editor bug is fixed.
 */

import { bodyRichness } from "@/lib/offline/document-body";
import { getOfflineDB } from "@/lib/offline/db";
import { getOfflineDocument } from "@/lib/offline/documents-cache";
import { isDocsVaultUnlocked } from "@/lib/offline/docs-vault";
import {
  getOutboxForDocument,
  type DocumentCreatePayload,
  type DocumentPatchPayload,
} from "@/lib/offline/outbox";
import { ensureDocsVaultUnlocked } from "@/lib/offline/offline-vault-session";
import { appendDevLog } from "@/lib/dev/client-error-log";

export type OutboxMutationSummary = {
  create: number;
  patch: number;
  delete: number;
  createBodyRichness: number;
  patchBodyRichness: number;
};

export type OfflineDocInspect = {
  documentId: string;
  navigatorOnline: boolean;
  vaultUnlocked: boolean | null;
  idbRowExists: boolean;
  idbTitle: string | null;
  idbWorkspaceId: string | null;
  idbSyncStatus: string | null;
  idbContentPlainLength: number | null;
  idbBodyRichness: number | null;
  yjsStateBytes: number | null;
  outboxEntries: number;
  outboxMutations: OutboxMutationSummary | null;
  decrypted: boolean;
  decryptError: string | null;
};

function summarizeOutbox(
  rows: Awaited<ReturnType<typeof getOutboxForDocument>>,
): OutboxMutationSummary {
  let createBodyRichness = 0;
  let patchBodyRichness = 0;
  let create = 0;
  let patch = 0;
  let del = 0;

  for (const row of rows) {
    if (row.mutation === "create") {
      create += 1;
      const payload = row.payload as DocumentCreatePayload;
      createBodyRichness = Math.max(
        createBodyRichness,
        bodyRichness(payload.content ?? null, payload.content_plain ?? null),
      );
    } else if (row.mutation === "patch") {
      patch += 1;
      const payload = row.payload as DocumentPatchPayload;
      patchBodyRichness = Math.max(
        patchBodyRichness,
        bodyRichness(payload.content ?? null, payload.content_plain ?? null),
      );
    } else if (row.mutation === "delete") {
      del += 1;
    }
  }

  return { create, patch, delete: del, createBodyRichness, patchBodyRichness };
}

export async function inspectOfflineDocument(
  documentId: string,
  userId?: string | null,
): Promise<OfflineDocInspect> {
  const result: OfflineDocInspect = {
    documentId,
    navigatorOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    vaultUnlocked: userId ? isDocsVaultUnlocked(userId) : null,
    idbRowExists: false,
    idbTitle: null,
    idbWorkspaceId: null,
    idbSyncStatus: null,
    idbContentPlainLength: null,
    idbBodyRichness: null,
    yjsStateBytes: null,
    outboxEntries: 0,
    outboxMutations: null,
    decrypted: false,
    decryptError: null,
  };

  try {
    const db = await getOfflineDB();
    const row = await db.get("documents", documentId);
    result.idbRowExists = Boolean(row);
    if (row) {
      result.idbTitle = row.title;
      result.idbWorkspaceId = row.workspace_id;
      result.idbSyncStatus = row.sync_status;
    }

    const yjsRow = await db.get("yjs_state", documentId);
    if (yjsRow?.state_enc) {
      result.yjsStateBytes = JSON.stringify(yjsRow.state_enc).length;
    }
  } catch (error) {
    result.decryptError =
      error instanceof Error ? error.message : "IndexedDB read failed";
    return result;
  }

  if (userId) {
    try {
      await ensureDocsVaultUnlocked(userId);
      result.vaultUnlocked = isDocsVaultUnlocked(userId);
    } catch (error) {
      result.vaultUnlocked = false;
      result.decryptError =
        error instanceof Error ? error.message : "Vault unlock failed";
    }
  }

  try {
    const doc = await getOfflineDocument(documentId);
    result.decrypted = Boolean(doc);
    if (doc) {
      result.idbTitle = doc.title;
      result.idbWorkspaceId = doc.workspace_id;
      result.idbSyncStatus = doc.sync_status;
      result.idbContentPlainLength = (doc.content_plain ?? "").trim().length;
      result.idbBodyRichness = bodyRichness(doc.content, doc.content_plain);
    }
  } catch (error) {
    result.decryptError =
      error instanceof Error ? error.message : "Decrypt failed";
  }

  try {
    const outbox = await getOutboxForDocument(documentId);
    result.outboxEntries = outbox.length;
    if (outbox.length > 0) {
      result.outboxMutations = summarizeOutbox(outbox);
    }
  } catch {
    /* ignore */
  }

  return result;
}

export function logOfflineDocInspect(
  phase: string,
  inspect: OfflineDocInspect,
): void {
  void appendDevLog(`offline-doc:${phase}`, inspect as unknown as Record<string, unknown>);
}

declare global {
  interface Window {
    __rhodesInspectDoc?: (documentId: string) => Promise<OfflineDocInspect>;
  }
}

export function installOfflineDocDebug(userId?: string | null): void {
  if (typeof window === "undefined") return;
  window.__rhodesInspectDoc = async (documentId: string) => {
    const inspect = await inspectOfflineDocument(documentId, userId);
    console.table(inspect);
    logOfflineDocInspect("manual", inspect);
    return inspect;
  };
}
