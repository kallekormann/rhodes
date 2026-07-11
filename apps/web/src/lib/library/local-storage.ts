import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LOCAL_ROOT = path.join(process.cwd(), ".data", "library-files");

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
