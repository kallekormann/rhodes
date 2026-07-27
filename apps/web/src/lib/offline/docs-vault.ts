/**
 * Per-user AES-GCM vault for offline document cache payloads (client-only).
 * Separate DEK from Ask — stored as `${userId}:docs` in the vault object store.
 */

import {
  decryptJson as decryptJsonWithKey,
  encryptJson as encryptJsonWithKey,
  exportAesGcmKey,
  generateAesGcmKey,
  importAesGcmKey,
} from "@/lib/offline/crypto";
import {
  getOfflineDB,
  type EncryptedBlob,
  type VaultRecord,
} from "@/lib/offline/db";

export type { EncryptedBlob };

export function docsVaultKey(userId: string): string {
  return `${userId}:docs`;
}

let memoryDek: CryptoKey | null = null;
let memoryUserId: string | null = null;

export function isDocsVaultUnlocked(userId?: string | null): boolean {
  if (!memoryDek || !memoryUserId) return false;
  if (userId && memoryUserId !== userId) return false;
  return true;
}

/** Drop in-memory docs DEK. Ciphertext and vault JWK remain in IndexedDB. */
export function lockDocsVault(): void {
  memoryDek = null;
  memoryUserId = null;
}

/**
 * Load or create the per-user document DEK and keep it in memory for this session.
 */
export async function unlockDocsVault(userId: string): Promise<void> {
  if (!userId) throw new Error("unlockDocsVault requires userId");
  if (memoryUserId === userId && memoryDek) return;

  const db = await getOfflineDB();
  const vaultId = docsVaultKey(userId);
  const existing = await db.get("vault", vaultId);

  if (existing?.dek_jwk) {
    memoryDek = await importAesGcmKey(existing.dek_jwk);
    memoryUserId = userId;
    return;
  }

  const dek = await generateAesGcmKey();
  const record: VaultRecord = {
    id: vaultId,
    dek_jwk: await exportAesGcmKey(dek),
    created_at: new Date().toISOString(),
  };
  await db.put("vault", record);
  memoryDek = dek;
  memoryUserId = userId;
}

export async function encryptDocsJson(value: unknown): Promise<EncryptedBlob> {
  if (!memoryDek) throw new Error("Docs vault is locked");
  return encryptJsonWithKey(memoryDek, value);
}

export async function decryptDocsJson<T>(blob: EncryptedBlob): Promise<T> {
  if (!memoryDek) throw new Error("Docs vault is locked");
  return decryptJsonWithKey<T>(memoryDek, blob);
}

export async function deleteDocsVaultForUser(userId: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("vault", docsVaultKey(userId));
  if (memoryUserId === userId) lockDocsVault();
}
