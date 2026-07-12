import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
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
