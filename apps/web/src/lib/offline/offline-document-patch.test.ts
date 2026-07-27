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
      transaction: (stores: string[]) => {
        const storesSet = new Set(stores);
        let txCommitted = false;
        const objectStore = (name: string) => ({
          put: async (
            record:
              | OfflineDocumentStorageRecord
              | OfflineOutboxStorageRecord,
          ) => {
            if (txCommitted) {
              throw new Error("transaction already committed");
            }
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
            if (txCommitted) {
              throw new Error("transaction already committed");
            }
            if ("id" in record && record.id !== undefined) {
              throw new Error("outbox add must omit id");
            }
            const id = nextOutboxId++;
            outboxRows.set(id, { ...record, id });
            return id;
          },
          delete: async (key: number) => {
            if (txCommitted) {
              throw new Error("transaction already committed");
            }
            outboxRows.delete(key);
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
  };
});

import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";
import { toOfflineDocumentRecord } from "@/lib/offline/documents-cache";
import { getOutboxForDocument } from "@/lib/offline/outbox";
import { commitOfflineDocumentPatch } from "@/lib/offline/offline-document-patch";

describe("offline-document-patch", () => {
  const userId = "user-1";
  const docId = "doc-1";

  beforeEach(() => {
    documentRows.clear();
    outboxRows.clear();
    vaultRows.clear();
    nextOutboxId = 1;
    lockDocsVault();
  });

  it("writes documents and outbox in one transaction", async () => {
    await unlockDocsVault(userId);

    await commitOfflineDocumentPatch({
      document: toOfflineDocumentRecord({
        id: docId,
        workspace_id: "ws-1",
        title: "Offline title",
        content: { type: "doc" },
        content_plain: "hello",
        updated_at: "2026-07-27T01:00:00.000Z",
        created_at: "2026-07-27T00:00:00.000Z",
        server_updated_at: "2026-07-27T00:00:00.000Z",
        sync_status: "pending",
      }),
      patch: { title: "Offline title" },
      expectedUpdatedAt: "2026-07-27T00:00:00.000Z",
    });

    expect(documentRows.get(docId)?.sync_status).toBe("pending");
    expect(outboxRows.size).toBe(1);
    const rows = await getOutboxForDocument(docId);
    expect(rows[0]?.payload).toEqual({ title: "Offline title" });
  });
});
