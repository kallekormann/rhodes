import {
  getOfflineDocumentStrict,
  type OfflineDocumentReadFailureReason,
  OfflineDocumentReadError,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import type { OfflineDocumentRecord } from "@/lib/offline/db";
import { ensureDocsVaultUnlocked } from "@/lib/offline/offline-vault-session";

export type LoadDocumentFailureReason =
  | OfflineDocumentReadFailureReason
  | "network_failed"
  | "invalid_id";

export type LoadDocumentResult =
  | { ok: true; source: "idb"; document: OfflineDocumentRecord }
  | {
      ok: false;
      reason: LoadDocumentFailureReason;
      detail?: string;
    };

function offlineErrorMessage(reason: LoadDocumentFailureReason): string {
  switch (reason) {
    case "vault_locked":
      return "Offline vault is locked — sign in again to decrypt cached documents";
    case "not_cached":
      return "Document not available offline";
    case "decrypt_failed":
      return "Could not decrypt cached document";
    case "idb_unavailable":
      return "Offline storage is unavailable";
    case "network_failed":
      return "Failed to load document";
    case "invalid_id":
      return "Invalid document id";
    default:
      return "Failed to load document";
  }
}

export function loadDocumentErrorMessage(
  reason: LoadDocumentFailureReason,
  detail?: string,
): string {
  if (process.env.NODE_ENV !== "production" && detail) {
    return `${offlineErrorMessage(reason)} (${detail})`;
  }
  return offlineErrorMessage(reason);
}

/** Read a document from encrypted IndexedDB, awaiting vault unlock first. */
export async function loadDocumentFromIdb(
  documentId: string,
  userId: string | null | undefined,
): Promise<LoadDocumentResult> {
  if (userId) {
    try {
      await ensureDocsVaultUnlocked(userId);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Vault unlock failed";
      return { ok: false, reason: "vault_locked", detail };
    }
  }

  try {
    const document = await getOfflineDocumentStrict(documentId);
    return { ok: true, source: "idb", document };
  } catch (error) {
    if (error instanceof OfflineDocumentReadError) {
      return { ok: false, reason: error.reason, detail: error.message };
    }
    const detail =
      error instanceof Error ? error.message : "IndexedDB read failed";
    return { ok: false, reason: "idb_unavailable", detail };
  }
}

export { toOfflineDocumentRecord };
