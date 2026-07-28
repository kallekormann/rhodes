import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { VaultRecord, YjsStateStorageRecord } from "@/lib/offline/db";

const yjsStateRows = new Map<string, YjsStateStorageRecord>();
const vaultRows = new Map<string, VaultRecord>();

vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return {
    ...actual,
    getOfflineDB: vi.fn(async () => ({
      get: async (store: string, key: string) => {
        if (store === "yjs_state") return yjsStateRows.get(key);
        if (store === "vault") return vaultRows.get(key);
        return undefined;
      },
      put: async (store: string, record: YjsStateStorageRecord | VaultRecord) => {
        if (store === "yjs_state") {
          yjsStateRows.set(
            (record as YjsStateStorageRecord).documentId,
            record as YjsStateStorageRecord,
          );
        }
        if (store === "vault") {
          vaultRows.set((record as VaultRecord).id, record as VaultRecord);
        }
      },
      delete: async (store: string, key: string) => {
        if (store === "yjs_state") yjsStateRows.delete(key);
      },
    })),
    getYjsState: async (documentId: string) => yjsStateRows.get(documentId) ?? null,
    putYjsState: async (record: YjsStateStorageRecord) => {
      yjsStateRows.set(record.documentId, record);
    },
    deleteYjsState: async (documentId: string) => {
      yjsStateRows.delete(documentId);
    },
  };
});

import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";
import { RhodesYjsPersistence } from "@/lib/offline/yjs-rhodes-persistence";

const PERSIST_WAIT_MS = 1_600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("RhodesYjsPersistence", () => {
  const userId = "user-1";
  const documentId = "c4d00a5c-3057-4bf6-8feb-5c43864693f2";

  beforeEach(() => {
    yjsStateRows.clear();
    vaultRows.clear();
    lockDocsVault();
  });

  it("debounces encrypted writes to yjs_state", async () => {
    await unlockDocsVault(userId);

    const doc = new Y.Doc();
    const persistence = new RhodesYjsPersistence(documentId, doc, userId);
    await persistence.whenSynced;

    doc.getMap("test").set("a", 1);
    expect(yjsStateRows.has(documentId)).toBe(false);

    await sleep(PERSIST_WAIT_MS);

    const stored = yjsStateRows.get(documentId);
    expect(stored?.state_enc?.ciphertext).toBeTruthy();
    expect(stored?.state_enc?.iv).toBeTruthy();

    persistence.destroy();
  });

  it("loads persisted state into a new doc instance", async () => {
    await unlockDocsVault(userId);

    const doc1 = new Y.Doc();
    const p1 = new RhodesYjsPersistence(documentId, doc1, userId);
    await p1.whenSynced;
    doc1.getMap("test").set("hello", "world");
    await sleep(PERSIST_WAIT_MS);
    p1.destroy();

    const doc2 = new Y.Doc();
    const p2 = new RhodesYjsPersistence(documentId, doc2, userId);
    await p2.whenSynced;
    expect(doc2.getMap("test").get("hello")).toBe("world");
    p2.destroy();
  });

  it("flushes pending edits on destroy", async () => {
    await unlockDocsVault(userId);

    const doc = new Y.Doc();
    const persistence = new RhodesYjsPersistence(documentId, doc, userId);
    await persistence.whenSynced;

    doc.getMap("test").set("a", 1);
    persistence.destroy();
    await sleep(200);

    expect(yjsStateRows.has(documentId)).toBe(true);
    doc.destroy();
  });

  it("stops writing after destroy", async () => {
    await unlockDocsVault(userId);

    const doc = new Y.Doc();
    const persistence = new RhodesYjsPersistence(documentId, doc, userId);
    await persistence.whenSynced;
    doc.getMap("test").set("x", 1);
    await sleep(PERSIST_WAIT_MS);
    persistence.destroy();
    await sleep(100);

    const afterDestroy = yjsStateRows.get(documentId);
    doc.getMap("test").set("y", 2);
    await sleep(PERSIST_WAIT_MS);

    expect(yjsStateRows.get(documentId)).toEqual(afterDestroy);
    doc.destroy();
  });
});
