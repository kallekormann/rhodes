/**
 * @vitest-environment node
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  getOfflineDB,
  resetOfflineDBConnection,
  type YjsStateStorageRecord,
} from "@/lib/offline/db";
import {
  ensureDocsVaultUnlocked,
  lockDocsVault,
  unlockDocsVault,
} from "@/lib/offline/docs-vault";
import {
  getOfflineDocument,
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { commitOfflineDocumentPatch } from "@/lib/offline/offline-document-patch";
import { getOutboxForDocument } from "@/lib/offline/outbox";
import {
  persistLocalYjsState,
  RhodesYjsPersistence,
} from "@/lib/offline/yjs-rhodes-persistence";

const userId = "integration-user";
const docId = "c4d00a5c-3057-4bf6-8feb-5c43864693f2";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("offline integration (fake-indexeddb)", () => {
  beforeEach(async () => {
    resetOfflineDBConnection();
    lockDocsVault();
  });

  it("opens rhodes-db with yjs_state object store", async () => {
    await unlockDocsVault(userId);
    const db = await getOfflineDB();
    expect(db.objectStoreNames.contains("yjs_state")).toBe(true);
    expect(db.objectStoreNames.contains("documents")).toBe(true);
    expect(db.objectStoreNames.contains("outbox")).toBe(true);
    expect(db.objectStoreNames.contains("vault")).toBe(true);
  });

  it("open-document cache write: vault + documents row", async () => {
    await ensureDocsVaultUnlocked(userId);

    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: docId,
        workspace_id: "ws-1",
        title: "Cached online",
        content: { type: "doc" },
        content_plain: "hello",
        updated_at: "2026-07-27T10:00:00.000Z",
        created_at: "2026-07-27T09:00:00.000Z",
        server_updated_at: "2026-07-27T10:00:00.000Z",
        sync_status: "synced",
      }),
    );

    const doc = await getOfflineDocument(docId);
    expect(doc?.title).toBe("Cached online");
    expect(doc?.sync_status).toBe("synced");

    const db = await getOfflineDB();
    const vault = await db.get("vault", `${userId}:docs`);
    expect(vault?.dek_jwk).toBeTruthy();
  });

  it("writes pending documents row and outbox entry for offline title edit", async () => {
    await unlockDocsVault(userId);
    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: docId,
        workspace_id: "ws-1",
        title: "Before offline",
        content: { type: "doc" },
        content_plain: "hello",
        updated_at: "2026-07-27T10:00:00.000Z",
        created_at: "2026-07-27T09:00:00.000Z",
        server_updated_at: "2026-07-27T10:00:00.000Z",
        sync_status: "synced",
      }),
    );

    await commitOfflineDocumentPatch({
      document: toOfflineDocumentRecord({
        id: docId,
        workspace_id: "ws-1",
        title: "Offline title",
        content: { type: "doc" },
        content_plain: "hello",
        updated_at: "2026-07-27T11:00:00.000Z",
        created_at: "2026-07-27T09:00:00.000Z",
        server_updated_at: "2026-07-27T10:00:00.000Z",
        sync_status: "pending",
      }),
      patch: { title: "Offline title" },
      expectedUpdatedAt: "2026-07-27T10:00:00.000Z",
    });

    const doc = await getOfflineDocument(docId);
    expect(doc?.sync_status).toBe("pending");
    expect(doc?.title).toBe("Offline title");

    const outbox = await getOutboxForDocument(docId);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.payload).toEqual({ title: "Offline title" });
  });

  it("rejects encrypted writes when docs vault is locked", async () => {
    await expect(
      putOfflineDocument(
        toOfflineDocumentRecord({
          id: docId,
          workspace_id: "ws-1",
          title: "No vault",
          content: { type: "doc" },
          content_plain: null,
          updated_at: "2026-07-27T10:00:00.000Z",
          created_at: "2026-07-27T09:00:00.000Z",
        }),
      ),
    ).rejects.toThrow("Docs vault is locked");

    await expect(
      persistLocalYjsState(docId, new Uint8Array([1, 2, 3]), null),
    ).rejects.toThrow("requires userId");
  });

  it("persists encrypted Yjs state to yjs_state after debounce", async () => {
    await unlockDocsVault(userId);
    const doc = new Y.Doc();
    const persistence = new RhodesYjsPersistence(docId, doc, userId);
    await persistence.whenSynced;

    doc.getMap("body").set("marker", "offline-body");
    await sleep(1_600);

    const db = await getOfflineDB();
    const row = (await db.get(
      "yjs_state",
      docId,
    )) as YjsStateStorageRecord | undefined;
    expect(row?.state_enc?.ciphertext).toBeTruthy();
    expect(row?.state_enc?.iv).toBeTruthy();

    persistence.destroy();
  });

  it("persistLocalYjsState writes immediately (provider offline path)", async () => {
    await unlockDocsVault(userId);
    const doc = new Y.Doc();
    doc.getMap("body").set("marker", "direct-offline");
    const state = Y.encodeStateAsUpdate(doc);

    await persistLocalYjsState(docId, state, userId);

    const db = await getOfflineDB();
    const row = (await db.get(
      "yjs_state",
      docId,
    )) as YjsStateStorageRecord | undefined;
    expect(row?.state_enc?.ciphertext).toBeTruthy();
  });
});
