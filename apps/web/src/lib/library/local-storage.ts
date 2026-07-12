import path from "node:path";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { libraryFilesDataDir } from "@rhodes/shared";

const LOCAL_ROOT = libraryFilesDataDir();

function resolvePath(storagePath: string): string {
  const normalized = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(LOCAL_ROOT, normalized);
  if (!full.startsWith(LOCAL_ROOT)) {
    throw new Error("Invalid library file path");
  }
  return full;
}

export async function saveLocalLibraryFile(
  storagePath: string,
  bytes: Uint8Array,
): Promise<void> {
  const full = resolvePath(storagePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function readLocalLibraryFile(
  storagePath: string,
): Promise<Uint8Array | null> {
  try {
    const full = resolvePath(storagePath);
    return new Uint8Array(await readFile(full));
  } catch {
    return null;
  }
}

export async function deleteLocalLibraryFile(storagePath: string): Promise<void> {
  try {
    await unlink(resolvePath(storagePath));
  } catch {
    // File may only exist in Supabase storage.
  }
}
