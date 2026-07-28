import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OfflineOutboxStorageRecord,
  VaultRecord,
} from "@/lib/offline/db";

const outboxRows = new Map<number, OfflineOutboxStorageRecord>();
const vaultRows = new Map<string, VaultRecord>();
let nextOutboxId = 1;

vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return {
    ...actual,
    getOfflineDB: vi.fn(async () => ({
      get: async (store: string, key: number) => {
        if (store === "outbox") return outboxRows.get(key);
        if (store === "vault") return vaultRows.get(key);
        return undefined;
      },
      getAll: async (store: string) => {
        if (store === "outbox") return Array.from(outboxRows.values());
        return [];
      },
      getAllFromIndex: async (
        store: string,
        _index: string,
        documentId: string,
      ) => {
        if (store !== "outbox") return [];
        return Array.from(outboxRows.values()).filter(
          (row) => row.document_id === documentId,
        );
      },
      add: async (store: string, record: OfflineOutboxStorageRecord) => {
        if (store !== "outbox") return;
        const id = nextOutboxId++;
        const stored = { ...record, id };
        outboxRows.set(id, stored);
        return id;
      },
      put: async (store: string, record: OfflineOutboxStorageRecord) => {
        if (store !== "outbox" || record.id == null) return;
        outboxRows.set(record.id, record);
      },
      delete: async (store: string, key: number) => {
        if (store === "outbox") outboxRows.delete(key);
      },
    })),
  };
});

import { lockDocsVault, unlockDocsVault, encryptDocsJson } from "@/lib/offline/docs-vault";
import {
  enqueueDocumentPatch,
  getOutboxForDocument,
  listOutbox,
  sortOutboxForDrain,
  documentHasPendingDelete,
} from "@/lib/offline/outbox";

describe("outbox encryption", () => {
  const userId = "user-1";
  const docId = "doc-1";

  beforeEach(() => {
    outboxRows.clear();
    vaultRows.clear();
    nextOutboxId = 1;
    lockDocsVault();
  });

  it("stores encrypted payload and decrypts on read", async () => {
    await unlockDocsVault(userId);

    await enqueueDocumentPatch({
      documentId: docId,
      patch: { title: "Offline title", metadata: { pinned: true } },
      expectedUpdatedAt: "2026-07-27T00:00:00.000Z",
    });

    const stored = Array.from(outboxRows.values())[0];
    expect(stored.payload_enc.ciphertext).toBeTruthy();
    expect(stored).not.toHaveProperty("payload");
    expect(stored.document_id).toBe(docId);

    const rows = await getOutboxForDocument(docId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toEqual({
      title: "Offline title",
      metadata: { pinned: true },
    });
    expect(rows[0]?.expected_updated_at).toBe("2026-07-27T00:00:00.000Z");
  });

  it("coalesces patches into one encrypted row", async () => {
    await unlockDocsVault(userId);

    await enqueueDocumentPatch({
      documentId: docId,
      patch: { title: "First" },
      expectedUpdatedAt: "2026-07-27T00:00:00.000Z",
    });
    await enqueueDocumentPatch({
      documentId: docId,
      patch: { metadata: { v: 2 } },
      expectedUpdatedAt: "2026-07-27T01:00:00.000Z",
    });

    expect(outboxRows.size).toBe(1);
    const rows = await listOutbox();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toEqual({
      title: "First",
      metadata: { v: 2 },
    });
    expect(rows[0]?.expected_updated_at).toBe("2026-07-27T00:00:00.000Z");
  });

  it("sorts drain queue with deletes before creates and patches", () => {
    const rows = sortOutboxForDrain([
      {
        id: 3,
        document_id: "doc-patch",
        mutation: "patch",
        payload: { title: "Patch" },
        expected_updated_at: "2026-07-27T02:00:00.000Z",
        created_at: "2026-07-27T02:00:00.000Z",
        retries: 0,
      },
      {
        id: 1,
        document_id: "doc-delete",
        mutation: "delete",
        payload: {},
        expected_updated_at: "2026-07-27T00:00:00.000Z",
        created_at: "2026-07-27T01:00:00.000Z",
        retries: 0,
      },
      {
        id: 2,
        document_id: "doc-create",
        mutation: "create",
        payload: { workspace_id: "ws-1", title: "New" },
        expected_updated_at: "",
        created_at: "2026-07-27T00:30:00.000Z",
        retries: 0,
      },
    ]);

    expect(rows.map((row) => row.mutation)).toEqual([
      "delete",
      "create",
      "patch",
    ]);
  });

  it("detects pending delete outbox rows", async () => {
    await unlockDocsVault(userId);

    outboxRows.set(1, {
      id: 1,
      document_id: docId,
      mutation: "delete",
      payload_enc: await encryptDocsJson({}),
      expected_updated_at: "2026-07-27T00:00:00.000Z",
      created_at: "2026-07-27T00:00:00.000Z",
      retries: 0,
    });

    expect(await documentHasPendingDelete(docId)).toBe(true);
  });
});
