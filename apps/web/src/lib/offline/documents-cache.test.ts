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
      getAll: async (store: string) => {
        if (store === "documents") return Array.from(documentRows.values());
        return [];
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
          return;
        }
        if (store === "vault") {
          vaultRows.set((record as VaultRecord).id, record as VaultRecord);
        }
      },
    })),
  };
});

import {
  getOfflineDocument,
  listOfflineDocumentsForWorkspace,
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";

describe("documents-cache encryption", () => {
  const userId = "user-1";
  const docId = "doc-1";

  beforeEach(() => {
    documentRows.clear();
    vaultRows.clear();
    lockDocsVault();
  });

  it("stores encrypted body fields and decrypts on read", async () => {
    await unlockDocsVault(userId);

    const record = toOfflineDocumentRecord({
      id: docId,
      workspace_id: "ws-1",
      title: "Visible title",
      content: { type: "doc", blocks: [{ id: "b1" }] },
      content_plain: "Hello offline",
      metadata: { tags: ["a"] },
      updated_at: "2026-07-27T00:00:00.000Z",
      created_at: "2026-07-27T00:00:00.000Z",
      sync_status: "pending",
    });

    await putOfflineDocument(record);

    const stored = documentRows.get(docId);
    expect(stored).toBeDefined();
    expect(stored?.title).toBe("Visible title");
    expect(stored?.sync_status).toBe("pending");
    expect(stored?.content_enc?.ciphertext).toBeTruthy();
    expect(stored?.content_plain_enc?.ciphertext).toBeTruthy();
    expect(stored?.metadata_enc?.ciphertext).toBeTruthy();
    expect(stored?.content_enc?.ciphertext).not.toContain("blocks");

    const loaded = await getOfflineDocument(docId);
    expect(loaded).toEqual(record);
  });

  it("rejects writes when the docs vault is locked", async () => {
    await expect(
      putOfflineDocument(
        toOfflineDocumentRecord({
          id: docId,
          workspace_id: "ws-1",
          title: "Draft",
          content: { type: "doc" },
          content_plain: null,
          updated_at: "2026-07-27T00:00:00.000Z",
          created_at: "2026-07-27T00:00:00.000Z",
        }),
      ),
    ).rejects.toThrow("Docs vault is locked");
  });

  it("lists documents for a workspace sorted by updated_at descending", async () => {
    await unlockDocsVault(userId);

    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: "doc-older",
        workspace_id: "ws-1",
        title: "Older",
        content: { type: "doc" },
        content_plain: null,
        updated_at: "2026-07-26T00:00:00.000Z",
        created_at: "2026-07-26T00:00:00.000Z",
      }),
    );
    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: "doc-newer",
        workspace_id: "ws-1",
        title: "Newer",
        content: { type: "doc" },
        content_plain: null,
        updated_at: "2026-07-27T00:00:00.000Z",
        created_at: "2026-07-27T00:00:00.000Z",
      }),
    );
    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: "doc-other-ws",
        workspace_id: "ws-2",
        title: "Other scope",
        content: { type: "doc" },
        content_plain: null,
        updated_at: "2026-07-28T00:00:00.000Z",
        created_at: "2026-07-28T00:00:00.000Z",
      }),
    );

    const listed = await listOfflineDocumentsForWorkspace("ws-1");
    expect(listed.map((doc) => doc.id)).toEqual(["doc-newer", "doc-older"]);
  });
});
