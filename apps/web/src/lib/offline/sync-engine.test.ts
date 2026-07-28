/**
 * @vitest-environment node
 */
import "fake-indexeddb/auto";
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
      add: async (store: string, record: OfflineOutboxStorageRecord) => {
        if (store === "outbox") {
          const id = nextOutboxId++;
          outboxRows.set(id, { ...record, id });
          return id;
        }
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
        if (store === "outbox") outboxRows.delete(key as number);
      },
      transaction: (stores: string[]) => {
        const storesSet = new Set(stores);
        let txCommitted = false;
        const objectStore = (name: string) => ({
          add: async (record: OfflineOutboxStorageRecord) => {
            if (txCommitted) throw new Error("transaction already committed");
            const id = nextOutboxId++;
            outboxRows.set(id, { ...record, id });
            return id;
          },
          delete: async (key: number) => {
            if (txCommitted) throw new Error("transaction already committed");
            outboxRows.delete(key);
          },
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
    getYjsState: vi.fn(async () => null),
    putYjsState: vi.fn(async () => {}),
  };
});

vi.mock("@/lib/offline/offline-document-access-cache", () => ({
  purgeDocumentOfflineCache: vi.fn(async () => {}),
}));

vi.mock("@/lib/offline/seed-server-yjs", () => ({
  seedServerYjsIfEmpty: vi.fn(async () => {}),
}));

import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";
import {
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { commitOfflineDocumentCreate } from "@/lib/offline/offline-document-mutations";
import { LOCAL_SERVER_UPDATED_AT } from "@/lib/offline/local-document";
import { pushOutbox } from "@/lib/offline/sync-engine";

const userId = "user-sync-engine";
const docId = "doc-create-rich";
const workspaceId = "ws-1";

describe("sync-engine pushCreate", () => {
  beforeEach(async () => {
    documentRows.clear();
    outboxRows.clear();
    vaultRows.clear();
    nextOutboxId = 1;
    lockDocsVault();
    await unlockDocsVault(userId);
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", {});
  });

  it("keeps pending and enqueues patch when server body is poorer than local", async () => {
    const document = toOfflineDocumentRecord({
      id: docId,
      workspace_id: workspaceId,
      title: "Offline",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "hello offline" }],
          },
        ],
      },
      content_plain: "hello offline",
      updated_at: "2026-07-27T10:00:00.000Z",
      created_at: "2026-07-27T09:00:00.000Z",
      server_updated_at: LOCAL_SERVER_UPDATED_AT,
      sync_status: "pending",
    });

    await commitOfflineDocumentCreate({
      document,
      create: {
        workspace_id: workspaceId,
        title: "Offline",
        content: { type: "doc", content: [] },
        content_plain: "",
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/app/api/documents") && init?.method === "POST") {
          return new Response(
            JSON.stringify({
              document: {
                id: docId,
                workspace_id: workspaceId,
                title: "Offline",
                content: { type: "doc", content: [] },
                content_plain: "",
                metadata: {},
                updated_at: "2026-07-27T10:01:00.000Z",
                created_at: "2026-07-27T09:00:00.000Z",
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    await pushOutbox();

    expect(documentRows.get(docId)?.sync_status).toBe("pending");
    const remainingOutbox = Array.from(outboxRows.values());
    expect(remainingOutbox.some((row) => row.mutation === "patch")).toBe(true);
  });
});
