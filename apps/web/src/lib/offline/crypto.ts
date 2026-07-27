/**
 * Shared AES-GCM helpers for offline IndexedDB encryption (Ask vault, docs vault, etc.).
 * Pure functions only — no per-user key state.
 */

import type { EncryptedBlob } from "@/lib/offline/db";

const AES_GCM_IV_BYTES = 12;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function generateAesGcmKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function importAesGcmKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportAesGcmKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

export async function encryptBytes(
  key: CryptoKey,
  data: Uint8Array,
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const plain = new Uint8Array(data);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuf)),
  };
}

export async function decryptBytes(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<Uint8Array> {
  const iv = new Uint8Array(base64ToBytes(blob.iv));
  const ciphertext = new Uint8Array(base64ToBytes(blob.ciphertext));
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new Uint8Array(plainBuf);
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
): Promise<EncryptedBlob> {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  return encryptBytes(key, encoded);
}

export async function decryptJson<T>(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<T> {
  const plain = await decryptBytes(key, blob);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
