import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OfflineDocumentStorageRecord,
  VaultRecord,
} from "@/lib/offline/db";

const documentRows = new Map<string, OfflineDocumentStorageRecord>();
const vaultRows = new Map<string, VaultRecord>();

vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return {
    ...actual,
    getOfflineDB: vi.fn(async () => ({
      get: async (store: string, key: string) => {
        if (store === "documents") return documentRows.get(key);
        if (store === "vault") return vaultRows.get(key);
        return undefined;
      },
      put: async (
        store: string,
        record: OfflineDocumentStorageRecord | VaultRecord,
      ) => {
        if (store === "documents") {
          documentRows.set(
            (record as OfflineDocumentStorageRecord).id,
            record as OfflineDocumentStorageRecord,
          );
        }
        if (store === "vault") {
          vaultRows.set((record as VaultRecord).id, record as VaultRecord);
        }
      },
    })),
  };
});

import {
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";
import { loadDocumentFromIdb } from "@/lib/offline/load-document";

vi.mock("@/lib/offline/offline-vault-session", () => ({
  ensureDocsVaultUnlocked: vi.fn(),
}));

import { ensureDocsVaultUnlocked } from "@/lib/offline/offline-vault-session";

const mockedEnsureVault = vi.mocked(ensureDocsVaultUnlocked);

describe("loadDocumentFromIdb", () => {
  const userId = "user-1";
  const docId = "doc-1";

  beforeEach(() => {
    documentRows.clear();
    vaultRows.clear();
    lockDocsVault();
  });

  it("returns not_cached when the row is missing", async () => {
    await unlockDocsVault(userId);
    const result = await loadDocumentFromIdb(docId, userId);
    expect(result).toEqual({
      ok: false,
      reason: "not_cached",
      detail: "Document is not cached for offline use",
    });
  });

  it("loads and decrypts a cached document after vault unlock", async () => {
    await unlockDocsVault(userId);
    const record = toOfflineDocumentRecord({
      id: docId,
      workspace_id: "ws-1",
      title: "Cached",
      content: { type: "doc" },
      content_plain: "hello",
      updated_at: "2026-07-27T00:00:00.000Z",
      created_at: "2026-07-27T00:00:00.000Z",
    });
    await putOfflineDocument(record);

    const result = await loadDocumentFromIdb(docId, userId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.title).toBe("Cached");
      expect(result.document.content_plain).toBe("hello");
    }
  });

  it("returns vault_locked when vault unlock fails", async () => {
    mockedEnsureVault.mockRejectedValueOnce(new Error("Vault unlock failed"));

    const result = await loadDocumentFromIdb(docId, userId);
    expect(result).toEqual({
      ok: false,
      reason: "vault_locked",
      detail: "Vault unlock failed",
    });
  });
});
