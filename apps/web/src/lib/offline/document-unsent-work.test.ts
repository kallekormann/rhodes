/**
 * @vitest-environment node
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { resetOfflineDBConnection, getOfflineDB } from "@/lib/offline/db";
import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";
import {
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import {
  documentHasUnsentWork,
  documentRecordHasUnsentWork,
} from "@/lib/offline/document-unsent-work";
import {
  getWorkspacePendingSyncInfo,
  reconcileWorkspaceOutboxFromCache,
} from "@/lib/offline/workspace-sync";

const userId = "user-unsent";
const workspaceId = "ws-1";
const docId = "doc-synced-cache";

describe("document unsent work detection", () => {
  beforeEach(async () => {
    resetOfflineDBConnection();
    lockDocsVault();
    await unlockDocsVault(userId);
    const db = await getOfflineDB();
    await db.clear("documents");
    await db.clear("outbox");
  });

  it("synced cached doc with body and empty outbox is not pending", async () => {
    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: docId,
        workspace_id: workspaceId,
        title: "Cached online doc",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "hello from server cache" }],
            },
          ],
        },
        content_plain: "hello from server cache",
        updated_at: "2026-07-27T10:00:00.000Z",
        created_at: "2026-07-27T09:00:00.000Z",
        server_updated_at: "2026-07-27T10:00:00.000Z",
        sync_status: "synced",
      }),
    );

    const doc = (await import("@/lib/offline/documents-cache")).getOfflineDocument;
    const row = await doc(docId);
    expect(row).toBeTruthy();
    expect(documentRecordHasUnsentWork(row!)).toBe(false);

    await reconcileWorkspaceOutboxFromCache(workspaceId);

    const pending = await getWorkspacePendingSyncInfo(workspaceId);
    expect(pending.pendingCount).toBe(0);
    expect(await documentHasUnsentWork(docId, workspaceId)).toBe(false);
  });

  it("pending doc is unsent work", async () => {
    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: docId,
        workspace_id: workspaceId,
        title: "Pending edit",
        content: { type: "doc", content: [] },
        content_plain: "",
        updated_at: "2026-07-27T11:00:00.000Z",
        created_at: "2026-07-27T09:00:00.000Z",
        server_updated_at: "2026-07-27T10:00:00.000Z",
        sync_status: "pending",
      }),
    );

    expect(await documentHasUnsentWork(docId, workspaceId)).toBe(true);
    const pending = await getWorkspacePendingSyncInfo(workspaceId);
    expect(pending.pendingCount).toBe(1);
  });
});
