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
      add: async (store: string, record: OfflineOutboxStorageRecord) => {
        if (store === "outbox") {
          const id = nextOutboxId++;
          outboxRows.set(id, { ...record, id });
        }
      },
    })),
  };
});

import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";
import { toOfflineDocumentRecord, putOfflineDocument } from "@/lib/offline/documents-cache";
import { enqueueDocumentPatch } from "@/lib/offline/outbox";
import { repairPendingStatusFromOutbox } from "@/lib/offline/offline-sync-status";

describe("offline-sync-status", () => {
  const userId = "user-1";
  const docId = "doc-1";

  beforeEach(async () => {
    documentRows.clear();
    outboxRows.clear();
    vaultRows.clear();
    nextOutboxId = 1;
    lockDocsVault();
    await unlockDocsVault(userId);

    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: docId,
        workspace_id: "ws-1",
        title: "Server title",
        content: { type: "doc" },
        content_plain: "hello",
        updated_at: "2026-07-27T10:00:00.000Z",
        created_at: "2026-07-27T09:00:00.000Z",
        server_updated_at: "2026-07-27T10:00:00.000Z",
        sync_status: "synced",
      }),
    );
  });

  it("restores pending when outbox exists but documents.sync_status is synced", async () => {
    await enqueueDocumentPatch({
      documentId: docId,
      patch: { title: "Offline title" },
      expectedUpdatedAt: "2026-07-27T10:00:00.000Z",
    });

    expect(documentRows.get(docId)?.sync_status).toBe("synced");
    expect(outboxRows.size).toBe(1);

    const repaired = await repairPendingStatusFromOutbox(docId);
    expect(repaired).toEqual([docId]);
    expect(documentRows.get(docId)?.sync_status).toBe("pending");
  });
});
