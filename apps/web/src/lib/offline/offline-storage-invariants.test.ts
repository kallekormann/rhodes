/**
 * M1b.1 slice 12 — single-storage-location and session-boundary invariants.
 * @vitest-environment node
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  clearOfflineCache,
  clearSyncedOfflineCache,
  getOfflineDB,
  putYjsState,
  resetOfflineDBConnection,
  type YjsStateStorageRecord,
} from "@/lib/offline/db";
import {
  encryptDocsJson,
  isDocsVaultUnlocked,
  lockDocsVault,
  unlockDocsVault,
} from "@/lib/offline/docs-vault";
import {
  getOfflineDocument,
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import {
  lockOfflineVaults,
  unlockOfflineVaults,
} from "@/lib/offline/offline-vault-session";
import { enqueueDocumentPatch, getOutboxForDocument } from "@/lib/offline/outbox";
import {
  getOfflineBase,
  storeOfflineBase,
} from "@/lib/offline/yjs-offline-snapshot";
import { isVaultUnlocked, lockVault } from "@/lib/offline/ask-vault";
import { base64ToUint8 } from "@/lib/collaboration/supabase-yjs-provider";

const userId = "invariant-user";
const docId = "c4d00a5c-3057-4bf6-8feb-5c43864693f2";

describe("offline storage invariants (M1b.1 slice 12)", () => {
  beforeEach(async () => {
    resetOfflineDBConnection();
    lockOfflineVaults();
    await clearOfflineCache();
  });

  it("lockOfflineVaults clears both Ask and docs vault keys (logout path)", async () => {
    await unlockOfflineVaults(userId);
    expect(isVaultUnlocked(userId)).toBe(true);
    expect(isDocsVaultUnlocked(userId)).toBe(true);

    lockOfflineVaults();
    expect(isVaultUnlocked(userId)).toBe(false);
    expect(isDocsVaultUnlocked(userId)).toBe(false);
  });

  it("clearOfflineCache wipes yjs_state along with documents and outbox", async () => {
    await unlockDocsVault(userId);

    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: docId,
        workspace_id: "ws-1",
        title: "Wipe me",
        content: { type: "doc" },
        content_plain: "secret",
        updated_at: "2026-07-27T10:00:00.000Z",
        created_at: "2026-07-27T09:00:00.000Z",
        sync_status: "synced",
      }),
    );
    await enqueueDocumentPatch({
      documentId: docId,
      patch: { title: "Pending" },
      expectedUpdatedAt: "2026-07-27T10:00:00.000Z",
    });
    await putYjsState({
      documentId: docId,
      state_enc: await encryptDocsJson("yjs-bytes"),
      updated_at: "2026-07-27T10:00:00.000Z",
    });

    const dbBefore = await getOfflineDB();
    expect(await dbBefore.count("documents")).toBe(1);
    expect(await dbBefore.count("outbox")).toBe(1);
    expect(await dbBefore.count("yjs_state")).toBe(1);

    lockVault();
    lockDocsVault();
    await clearOfflineCache();

    const dbAfter = await getOfflineDB();
    expect(await dbAfter.count("documents")).toBe(0);
    expect(await dbAfter.count("outbox")).toBe(0);
    expect(await dbAfter.count("yjs_state")).toBe(0);
  });

  it("clearSyncedOfflineCache wipes yjs_state without touching vault", async () => {
    await unlockDocsVault(userId);

    await putYjsState({
      documentId: docId,
      state_enc: await encryptDocsJson("yjs-bytes"),
      updated_at: "2026-07-27T10:00:00.000Z",
    });

    const dbBefore = await getOfflineDB();
    expect(await dbBefore.count("yjs_state")).toBe(1);
    expect(await dbBefore.get("vault", `${userId}:docs`)).toBeTruthy();

    await clearSyncedOfflineCache();

    const dbAfter = await getOfflineDB();
    expect(await dbAfter.count("yjs_state")).toBe(0);
    expect(await dbAfter.get("vault", `${userId}:docs`)).toBeTruthy();
  });

  it("encryption round-trips documents, outbox, snapshots, and yjs_state", async () => {
    await unlockDocsVault(userId);

    const record = toOfflineDocumentRecord({
      id: docId,
      workspace_id: "ws-1",
      title: "Round trip",
      content: { type: "doc", blocks: [{ id: "b1", text: "body" }] },
      content_plain: "body text",
      metadata: { color: "blue" },
      updated_at: "2026-07-27T10:00:00.000Z",
      created_at: "2026-07-27T09:00:00.000Z",
      sync_status: "pending",
    });
    await putOfflineDocument(record);
    expect(await getOfflineDocument(docId)).toEqual(record);

    await enqueueDocumentPatch({
      documentId: docId,
      patch: { title: "Round trip", metadata: { color: "blue" } },
      expectedUpdatedAt: "2026-07-27T10:00:00.000Z",
    });
    const outbox = await getOutboxForDocument(docId);
    expect(outbox[0]?.payload).toEqual({
      title: "Round trip",
      metadata: { color: "blue" },
    });

    const ydoc = new Y.Doc();
    ydoc.getXmlFragment("default").insert(0, [new Y.XmlText("snapshot body")]);
    await storeOfflineBase(docId, Y.encodeStateAsUpdate(ydoc));
    const snapshot = await getOfflineBase(docId);
    expect(snapshot?.state).toBeTruthy();
    const restored = new Y.Doc();
    Y.applyUpdate(restored, base64ToUint8(snapshot!.state));
    expect(restored.getXmlFragment("default").toString()).toContain(
      "snapshot body",
    );

    await putYjsState({
      documentId: docId,
      state_enc: await encryptDocsJson("live-yjs-state"),
      updated_at: "2026-07-27T10:00:00.000Z",
    });
    const db = await getOfflineDB();
    const yjsRow = (await db.get(
      "yjs_state",
      docId,
    )) as YjsStateStorageRecord | undefined;
    expect(yjsRow?.state_enc?.ciphertext).toBeTruthy();
    expect(yjsRow?.state_enc?.iv).toBeTruthy();
  });
});
