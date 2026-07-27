import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultRecord } from "@/lib/offline/db";

const metaRows = new Map<string, unknown>();
const vaultRows = new Map<string, VaultRecord>();

vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return {
    ...actual,
    getOfflineDB: vi.fn(async () => ({
      get: async (store: string, key: string) => {
        if (store === "meta") return metaRows.get(key);
        if (store === "vault") return vaultRows.get(key);
        return undefined;
      },
      put: async (store: string, value: unknown, key?: string) => {
        if (store === "meta" && key) metaRows.set(key, value);
        if (store === "vault") {
          vaultRows.set((value as VaultRecord).id, value as VaultRecord);
        }
      },
    })),
  };
});

import {
  getOfflineBase,
  storeOfflineBase,
} from "@/lib/offline/yjs-offline-snapshot";
import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";
import { base64ToUint8 } from "@/lib/collaboration/supabase-yjs-provider";
import * as Y from "yjs";

describe("yjs offline snapshot encryption", () => {
  const userId = "user-1";
  const docId = "doc-1";

  beforeEach(() => {
    metaRows.clear();
    vaultRows.clear();
    lockDocsVault();
  });

  it("stores encrypted state in meta and decrypts on read", async () => {
    await unlockDocsVault(userId);

    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("default");
    fragment.insert(0, [new Y.XmlText("secret offline body")]);
    const state = Y.encodeStateAsUpdate(doc);

    await storeOfflineBase(docId, state);

    const raw = metaRows.get(`offline_base:${docId}`) as {
      state_enc?: { ciphertext: string };
      state?: string;
    };
    expect(raw?.state_enc?.ciphertext).toBeTruthy();
    expect(raw?.state).toBeUndefined();
    expect(raw?.state_enc?.ciphertext).not.toContain("secret");

    const loaded = await getOfflineBase(docId);
    expect(loaded?.state).toBeTruthy();
    expect(loaded?.capturedAt).toBeTruthy();

    const restored = new Y.Doc();
    Y.applyUpdate(restored, base64ToUint8(loaded!.state));
    expect(restored.getXmlFragment("default").toString()).toContain("secret");
  });
});
