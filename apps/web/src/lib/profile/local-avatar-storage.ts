import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { avatarsDataDir } from "@rhodes/shared";

const LOCAL_ROOT = avatarsDataDir();

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

function resolvePath(storagePath: string): string {
  const normalized = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(LOCAL_ROOT, normalized);
  if (!full.startsWith(LOCAL_ROOT)) {
    throw new Error("Invalid avatar path");
  }
  return full;
}

export function contentTypeForAvatarPath(storagePath: string): string {
  const ext = storagePath.split(".").pop()?.toLowerCase();
  return (ext && EXTENSION_MIME[ext]) || "application/octet-stream";
}

export async function saveLocalAvatar(
  storagePath: string,
  bytes: Uint8Array,
): Promise<void> {
  const full = resolvePath(storagePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function readLocalAvatar(
  storagePath: string,
): Promise<Uint8Array | null> {
  try {
    const full = resolvePath(storagePath);
    return new Uint8Array(await readFile(full));
  } catch {
    return null;
  }
}

export async function removeLocalAvatar(storagePath: string): Promise<void> {
  try {
    const full = resolvePath(storagePath);
    await unlink(full);
  } catch {
    // ignore missing files
  }
}
