import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OfflineDocumentStorageRecord,
  OfflineOutboxStorageRecord,
  VaultRecord,
} from "@/lib/offline/db";

const documentRows = new Map<string, OfflineDocumentStorageRecord>();
const outboxRows = new Map<number, OfflineOutboxStorageRecord>();
const vaultRows = new Map<string, VaultRecord>();
let nextOutboxId = 1;

vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return {
    ...actual,
    getOfflineDB: vi.fn(async () => ({
      get: async (store: string, key: string | number) => {
        if (store === "documents") return documentRows.get(String(key));
        if (store === "outbox") return outboxRows.get(key as number);
        if (store === "vault") return vaultRows.get(String(key));
        return undefined;
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
      delete: async (store: string, key: string | number) => {
        if (store === "documents") {
          documentRows.delete(String(key));
          return;
        }
        if (store === "outbox") {
          outboxRows.delete(key as number);
        }
      },
      transaction: (stores: string[]) => {
        const storesSet = new Set(stores);
        let txCommitted = false;
        const objectStore = (name: string) => ({
          put: async (
            record:
              | OfflineDocumentStorageRecord
              | OfflineOutboxStorageRecord,
          ) => {
            if (txCommitted) throw new Error("transaction already committed");
            if (name === "documents" && storesSet.has("documents")) {
              documentRows.set(
                (record as OfflineDocumentStorageRecord).id,
                record as OfflineDocumentStorageRecord,
              );
              return;
            }
            if (name === "outbox" && storesSet.has("outbox")) {
              const outboxRecord = record as OfflineOutboxStorageRecord;
              if (outboxRecord.id == null) {
                throw new Error("outbox put requires id");
              }
              outboxRows.set(outboxRecord.id, outboxRecord);
            }
          },
          add: async (record: OfflineOutboxStorageRecord) => {
            if (txCommitted) throw new Error("transaction already committed");
            if ("id" in record && record.id !== undefined) {
              throw new Error("outbox add must omit id");
            }
            const id = nextOutboxId++;
            outboxRows.set(id, { ...record, id });
            return id;
          },
          delete: async (key: string | number) => {
            if (txCommitted) throw new Error("transaction already committed");
            if (name === "documents" && storesSet.has("documents")) {
              documentRows.delete(String(key));
              return;
            }
            if (name === "outbox" && storesSet.has("outbox")) {
              outboxRows.delete(key as number);
            }
          },
        });
        return {
          objectStore,
          get done() {
            txCommitted = true;
            return Promise.resolve();
          },
        };
      },
    })),
    deleteYjsState: vi.fn(async () => {}),
  };
});

vi.mock("@/lib/offline/yjs-offline-snapshot", () => ({
  clearOfflineSnapshots: vi.fn(async () => {}),
}));

vi.mock("@/lib/offline/yjs-rhodes-persistence", () => ({
  clearRhodesYjsPersistence: vi.fn(async () => {}),
}));

import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";
import { getOfflineDocument } from "@/lib/offline/documents-cache";
import { LOCAL_SERVER_UPDATED_AT } from "@/lib/offline/local-document";
import { getOutboxForDocument } from "@/lib/offline/outbox";
import {
  buildOfflineCreateDocument,
  commitOfflineDocumentCreate,
  commitOfflineDocumentDelete,
  commitOfflineLocalDocumentUpdate,
} from "@/lib/offline/offline-document-mutations";

describe("offline-document-mutations", () => {
  const userId = "user-1";

  beforeEach(() => {
    documentRows.clear();
    outboxRows.clear();
    vaultRows.clear();
    nextOutboxId = 1;
    lockDocsVault();
  });

  it("creates a local document and create outbox row atomically", async () => {
    await unlockDocsVault(userId);

    const { document, create } = await buildOfflineCreateDocument({
      id: "doc-local-1",
      workspaceId: "ws-1",
      title: "Offline draft",
    });

    await commitOfflineDocumentCreate({ document, create });

    const stored = await getOfflineDocument("doc-local-1");
    expect(stored?.title).toBe("Offline draft");
    expect(stored?.server_updated_at).toBe(LOCAL_SERVER_UPDATED_AT);

    const outbox = await getOutboxForDocument("doc-local-1");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.mutation).toBe("create");
    expect(outbox[0]?.payload).toMatchObject({
      workspace_id: "ws-1",
      title: "Offline draft",
    });
  });

  it("merges title renames into the create outbox for local-only documents", async () => {
    await unlockDocsVault(userId);

    const { document, create } = await buildOfflineCreateDocument({
      id: "doc-local-2",
      workspaceId: "ws-1",
    });
    await commitOfflineDocumentCreate({ document, create });

    await commitOfflineLocalDocumentUpdate({
      document: {
        ...document,
        title: "Renamed offline",
        updated_at: "2026-07-27T02:00:00.000Z",
      },
      patch: { title: "Renamed offline" },
    });

    const stored = await getOfflineDocument("doc-local-2");
    expect(stored?.title).toBe("Renamed offline");

    const outbox = await getOutboxForDocument("doc-local-2");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.mutation).toBe("create");
    expect(outbox[0]?.payload).toMatchObject({ title: "Renamed offline" });
  });

  it("purges local-only deletes without a server delete outbox", async () => {
    await unlockDocsVault(userId);

    const { document, create } = await buildOfflineCreateDocument({
      id: "doc-local-3",
      workspaceId: "ws-1",
    });
    await commitOfflineDocumentCreate({ document, create });

    await commitOfflineDocumentDelete({
      documentId: "doc-local-3",
      serverUpdatedAt: LOCAL_SERVER_UPDATED_AT,
      localOnly: true,
    });

    expect(await getOfflineDocument("doc-local-3")).toBeNull();
    expect(await getOutboxForDocument("doc-local-3")).toHaveLength(0);
  });

  it("queues delete outbox for previously synced documents", async () => {
    await unlockDocsVault(userId);

    const { document, create } = await buildOfflineCreateDocument({
      id: "doc-synced-1",
      workspaceId: "ws-1",
    });
    const synced = {
      ...document,
      server_updated_at: "2026-07-27T00:00:00.000Z",
      sync_status: "synced" as const,
    };
    await commitOfflineDocumentCreate({
      document: synced,
      create,
    });

    await commitOfflineDocumentDelete({
      documentId: "doc-synced-1",
      serverUpdatedAt: "2026-07-27T00:00:00.000Z",
      localOnly: false,
    });

    expect(await getOfflineDocument("doc-synced-1")).toBeNull();
    const outbox = await getOutboxForDocument("doc-synced-1");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.mutation).toBe("delete");
  });
});
