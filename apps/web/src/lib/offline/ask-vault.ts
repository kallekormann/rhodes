/**
 * Per-user AES-GCM vault for Ask conversation payloads (client-only).
 * DEK lives in IndexedDB as exportable JWK; plaintext DEK only in memory while logged in.
 */

import {
  getOfflineDB,
  wipeAskDataForUser,
  type EncryptedBlob,
  type VaultRecord,
} from "@/lib/offline/db";

export type { EncryptedBlob };

let memoryDek: CryptoKey | null = null;
let memoryUserId: string | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function importDek(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function exportDek(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

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
    memoryDek = await importDek(existing.dek_jwk);
    memoryUserId = userId;
    return;
  }

  const dek = await generateDek();
  const record: VaultRecord = {
    id: userId,
    dek_jwk: await exportDek(dek),
    created_at: new Date().toISOString(),
  };
  await db.put("vault", record);
  memoryDek = dek;
  memoryUserId = userId;
}

export async function encryptJson(value: unknown): Promise<EncryptedBlob> {
  if (!memoryDek) throw new Error("Ask vault is locked");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    memoryDek,
    encoded,
  );
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuf)),
  };
}

export async function decryptJson<T>(blob: EncryptedBlob): Promise<T> {
  if (!memoryDek) throw new Error("Ask vault is locked");
  const iv = base64ToBytes(blob.iv);
  const ciphertext = base64ToBytes(blob.ciphertext);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    memoryDek,
    ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
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
