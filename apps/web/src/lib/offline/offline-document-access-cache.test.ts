/**
 * @vitest-environment node
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOfflineDB, resetOfflineDBConnection } from "@/lib/offline/db";
import {
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";
import {
  fetchCanOfflineEditDocument,
  purgeDocumentOfflineCache,
  syncOfflineDocumentAccess,
} from "@/lib/offline/offline-document-access-cache";

describe("offline-document-access-cache", () => {
  const userId = "user-1";
  const documentId = "doc-1";
  const document = {
    id: documentId,
    workspace_id: "ws-1",
    title: "Test",
    content: { type: "doc" },
    content_plain: "hello",
    metadata: null,
    updated_at: "2026-07-27T10:00:00.000Z",
    created_at: "2026-07-27T09:00:00.000Z",
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    resetOfflineDBConnection();
    lockDocsVault();
    await unlockDocsVault(userId);
    const db = await getOfflineDB();
    await db.clear("documents");
  });

  it("fetchCanOfflineEditDocument reads can_offline_edit from shares API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ can_offline_edit: true }),
      }),
    );

    await expect(fetchCanOfflineEditDocument(documentId, "ws-1")).resolves.toBe(true);
  });

  it("purgeDocumentOfflineCache removes the documents row", async () => {
    await putOfflineDocument(
      toOfflineDocumentRecord({
        ...document,
        server_updated_at: document.updated_at,
        sync_status: "synced",
      }),
    );

    await purgeDocumentOfflineCache(documentId);

    const db = await getOfflineDB();
    expect(await db.get("documents", documentId)).toBeUndefined();
  });

  it("syncOfflineDocumentAccess purges when offline access is denied", async () => {
    await putOfflineDocument(
      toOfflineDocumentRecord({
        ...document,
        server_updated_at: document.updated_at,
        sync_status: "synced",
      }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ can_offline_edit: false }),
      }),
    );

    await syncOfflineDocumentAccess({
      documentId,
      userId,
      activeWorkspaceId: "ws-1",
      document,
    });

    const db = await getOfflineDB();
    expect(await db.get("documents", documentId)).toBeUndefined();
  });

  it("syncOfflineDocumentAccess caches when offline access is allowed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ can_offline_edit: true }),
      }),
    );

    await syncOfflineDocumentAccess({
      documentId,
      userId,
      activeWorkspaceId: "ws-1",
      document,
    });

    const db = await getOfflineDB();
    expect(await db.get("documents", documentId)).toBeTruthy();
  });
});
