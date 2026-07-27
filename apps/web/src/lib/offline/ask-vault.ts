/**
 * Per-user AES-GCM vault for Ask conversation payloads (client-only).
 * DEK lives in IndexedDB as exportable JWK; plaintext DEK only in memory while logged in.
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
  wipeAskDataForUser,
  type EncryptedBlob,
  type VaultRecord,
} from "@/lib/offline/db";

export type { EncryptedBlob };

let memoryDek: CryptoKey | null = null;
let memoryUserId: string | null = null;

export function isVaultUnlocked(userId?: string | null): boolean {
  if (!memoryDek || !memoryUserId) return false;
  if (userId && memoryUserId !== userId) return false;
  return true;
}

/** Drop in-memory DEK. Ciphertext and vault JWK remain in IndexedDB. */
export function lockVault(): void {
  memoryDek = null;
  memoryUserId = null;
}

/**
 * Load or create the per-user DEK and keep it in memory for this session.
 */
export async function unlockVault(userId: string): Promise<void> {
  if (!userId) throw new Error("unlockVault requires userId");
  if (memoryUserId === userId && memoryDek) return;

  const db = await getOfflineDB();
  const existing = await db.get("vault", userId);

  if (existing?.dek_jwk) {
    memoryDek = await importAesGcmKey(existing.dek_jwk);
    memoryUserId = userId;
    return;
  }

  const dek = await generateAesGcmKey();
  const record: VaultRecord = {
    id: userId,
    dek_jwk: await exportAesGcmKey(dek),
    created_at: new Date().toISOString(),
  };
  await db.put("vault", record);
  memoryDek = dek;
  memoryUserId = userId;
}

export async function encryptJson(value: unknown): Promise<EncryptedBlob> {
  if (!memoryDek) throw new Error("Ask vault is locked");
  return encryptJsonWithKey(memoryDek, value);
}

export async function decryptJson<T>(blob: EncryptedBlob): Promise<T> {
  if (!memoryDek) throw new Error("Ask vault is locked");
  return decryptJsonWithKey<T>(memoryDek, blob);
}

export async function deleteVaultForUser(userId: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("vault", userId);
  if (memoryUserId === userId) lockVault();
}

/** Account delete: drop in-memory DEK and wipe this user’s Ask ciphertext + vault. */
export async function wipeAskDataOnAccountDelete(userId: string): Promise<void> {
  lockVault();
  await wipeAskDataForUser(userId);
}
