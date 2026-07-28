import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineDocumentStorageRecord } from "@/lib/offline/db";

const documentRows = new Map<string, OfflineDocumentStorageRecord>();
const yjsDeleted: string[] = [];

vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return {
    ...actual,
    getOfflineDB: vi.fn(async () => ({
      getAllFromIndex: async (
        store: string,
        _index: string,
        workspaceId: string,
      ) => {
        if (store !== "documents") return [];
        return Array.from(documentRows.values()).filter(
          (row) => row.workspace_id === workspaceId,
        );
      },
      delete: async (store: string, key: string) => {
        if (store === "documents") documentRows.delete(key);
      },
    })),
    deleteYjsState: vi.fn(async (documentId: string) => {
      yjsDeleted.push(documentId);
    }),
  };
});

vi.mock("@/lib/offline/offline-sync-status", () => ({
  documentHasPendingOutbox: vi.fn(async () => false),
}));

import { evictWorkspaceDocumentsIfNeeded } from "@/lib/offline/cache-eviction";

describe("cache-eviction", () => {
  beforeEach(() => {
    documentRows.clear();
    yjsDeleted.length = 0;
  });

  it("evicts oldest synced docs when over cap", async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const id = `doc-${i}`;
      documentRows.set(id, {
        id,
        workspace_id: "ws-1",
        title: `Doc ${i}`,
        content_enc: null,
        content_plain_enc: null,
        metadata_enc: null,
        server_updated_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        sync_status: "synced",
        last_accessed_at: new Date(now - i * 60_000).toISOString(),
      });
    }

    const result = await evictWorkspaceDocumentsIfNeeded("ws-1", 2);
    expect(result.evicted).toBe(1);
    expect(documentRows.has("doc-0")).toBe(true);
    expect(documentRows.has("doc-1")).toBe(true);
    expect(documentRows.has("doc-2")).toBe(false);
    expect(yjsDeleted).toContain("doc-2");
  });
});
