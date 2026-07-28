/**
 * @vitest-environment node
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetOfflineDBConnection, getOfflineDB } from "@/lib/offline/db";
import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";
import {
  listOfflineDocumentsForWorkspace,
  putOfflineDocument,
  toOfflineDocumentRecord,
} from "@/lib/offline/documents-cache";
import { bodyRichness } from "@/lib/offline/document-body";
import { LOCAL_SERVER_UPDATED_AT } from "@/lib/offline/local-document";
import { commitOfflineDocumentCreate } from "@/lib/offline/offline-document-mutations";
import { getOutboxForDocument } from "@/lib/offline/outbox";
import {
  getWorkspacePendingSyncInfo,
  reconcileWorkspaceOutboxFromCache,
  syncIfNeeded,
} from "@/lib/offline/workspace-sync";

vi.mock("@/lib/offline/sync-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/sync-engine")>();
  return {
    ...actual,
    pushOutbox: vi.fn(async () => ({ pushed: 0, stoppedOnNetwork: false })),
    pullWorkspaceDocuments: vi.fn(async () => ({ pulled: 0 })),
  };
});

const userId = "user-ws-sync";
const workspaceId = "ws-1";
const docId = "doc-offline-create";

describe("workspace-sync reconcile", () => {
  beforeEach(async () => {
    resetOfflineDBConnection();
    lockDocsVault();
    await unlockDocsVault(userId);
    const db = await getOfflineDB();
    await db.clear("documents");
    await db.clear("outbox");
  });

  it("merges IDB body into create outbox before push", async () => {
    const document = toOfflineDocumentRecord({
      id: docId,
      workspace_id: workspaceId,
      title: "Offline doc",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "offline body" }],
          },
        ],
      },
      content_plain: "offline body",
      updated_at: "2026-07-27T10:00:00.000Z",
      created_at: "2026-07-27T09:00:00.000Z",
      server_updated_at: LOCAL_SERVER_UPDATED_AT,
      sync_status: "pending",
    });

    await commitOfflineDocumentCreate({
      document,
      create: {
        workspace_id: workspaceId,
        title: "Offline doc",
        content: { type: "doc", content: [] },
        content_plain: "",
      },
    });

    const listed = await listOfflineDocumentsForWorkspace(workspaceId);
    expect(listed).toHaveLength(1);
    expect(bodyRichness(listed[0]!.content, listed[0]!.content_plain)).toBeGreaterThan(
      0,
    );

    await reconcileWorkspaceOutboxFromCache(workspaceId);

    const outbox = (await getOutboxForDocument(docId)).filter(
      (row) => row.mutation === "create",
    );
    expect(outbox).toHaveLength(1);
    expect(
      (outbox[0]?.payload as { content_plain?: string }).content_plain,
    ).toBe("offline body");
  });

  it("does not enqueue patch for synced cache with body and no outbox", async () => {
    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: docId,
        workspace_id: workspaceId,
        title: "Synced cache",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "rich cached body" }],
            },
          ],
        },
        content_plain: "rich cached body",
        updated_at: "2026-07-27T10:00:00.000Z",
        created_at: "2026-07-27T09:00:00.000Z",
        server_updated_at: "2026-07-27T10:00:00.000Z",
        sync_status: "synced",
      }),
    );

    await reconcileWorkspaceOutboxFromCache(workspaceId);

    const outbox = await getOutboxForDocument(docId);
    expect(outbox).toHaveLength(0);

    const pending = await getWorkspacePendingSyncInfo(workspaceId);
    expect(pending.pendingCount).toBe(0);
  });

  it("syncIfNeeded skips when nothing is pending", async () => {
    await putOfflineDocument(
      toOfflineDocumentRecord({
        id: docId,
        workspace_id: workspaceId,
        title: "Synced",
        content: { type: "doc", content: [] },
        content_plain: "",
        updated_at: "2026-07-27T10:00:00.000Z",
        created_at: "2026-07-27T09:00:00.000Z",
        server_updated_at: "2026-07-27T10:00:00.000Z",
        sync_status: "synced",
      }),
    );

    const result = await syncIfNeeded(workspaceId);
    expect(result.skipped).toBe(true);
    expect(result.pushed).toBe(0);
  });
});
