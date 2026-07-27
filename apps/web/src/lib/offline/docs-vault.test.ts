import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultRecord } from "@/lib/offline/db";

const vaultRows = new Map<string, VaultRecord>();

vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return {
    ...actual,
    getOfflineDB: vi.fn(async () => ({
      get: async (_store: "vault", key: string) => vaultRows.get(key),
      put: async (_store: "vault", record: VaultRecord) => {
        vaultRows.set(record.id, record);
      },
      delete: async (_store: "vault", key: string) => {
        vaultRows.delete(key);
      },
    })),
  };
});

import {
  decryptDocsJson,
  docsVaultKey,
  encryptDocsJson,
  isDocsVaultUnlocked,
  lockDocsVault,
  unlockDocsVault,
} from "@/lib/offline/docs-vault";
import {
  encryptJson as encryptAskJson,
  isVaultUnlocked,
  lockVault,
  unlockVault,
} from "@/lib/offline/ask-vault";

describe("docs-vault", () => {
  const userId = "user-1";

  beforeEach(() => {
    vaultRows.clear();
    lockDocsVault();
    lockVault();
  });

  it("round-trips JSON after unlock", async () => {
    await unlockDocsVault(userId);
    const payload = { title: "Draft", blocks: [1, 2] };
    const blob = await encryptDocsJson(payload);
    expect(await decryptDocsJson<typeof payload>(blob)).toEqual(payload);
  });

  it("lock clears the in-memory docs key", async () => {
    await unlockDocsVault(userId);
    expect(isDocsVaultUnlocked(userId)).toBe(true);
    lockDocsVault();
    expect(isDocsVaultUnlocked(userId)).toBe(false);
    await expect(encryptDocsJson({ ok: true })).rejects.toThrow(
      "Docs vault is locked",
    );
  });

  it("stores docs DEK under a separate vault key from Ask", async () => {
    await unlockDocsVault(userId);
    expect(vaultRows.has(docsVaultKey(userId))).toBe(true);
    expect(vaultRows.has(userId)).toBe(false);
  });

  it("does not unlock Ask when docs vault unlocks", async () => {
    await unlockDocsVault(userId);
    expect(isDocsVaultUnlocked(userId)).toBe(true);
    expect(isVaultUnlocked(userId)).toBe(false);
  });

  it("does not unlock docs when Ask vault unlocks", async () => {
    await unlockVault(userId);
    expect(isVaultUnlocked(userId)).toBe(true);
    expect(isDocsVaultUnlocked(userId)).toBe(false);
  });

  it("uses independent DEKs for Ask and docs", async () => {
    await unlockVault(userId);
    await unlockDocsVault(userId);

    const askBlob = await encryptAskJson({ channel: "ask" });
    const docsBlob = await encryptDocsJson({ channel: "docs" });

    expect(askBlob.ciphertext).not.toBe(docsBlob.ciphertext);
    await expect(decryptDocsJson(askBlob)).rejects.toThrow();
  });
});
