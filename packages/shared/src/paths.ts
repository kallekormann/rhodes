import { existsSync } from "node:fs";
import path from "node:path";

function findMonorepoRoot(start: string): string {
  let dir = path.resolve(start);
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return path.resolve(start);
}

/** Monorepo-local dev data root (library files, document images, …). */
export function rhodesDataDir(): string {
  if (process.env.RHODES_DATA_DIR) {
    return process.env.RHODES_DATA_DIR;
  }
  return path.join(findMonorepoRoot(process.cwd()), ".data");
}

/** Shared dev fallback directory for library file bytes (web upload + worker ingest). */
export function libraryFilesDataDir(): string {
  if (process.env.RHODES_LIBRARY_DATA_DIR) {
    return process.env.RHODES_LIBRARY_DATA_DIR;
  }
  return path.join(rhodesDataDir(), "library-files");
}

/** Shared dev fallback directory for inline document images. */
export function documentImagesDataDir(): string {
  if (process.env.RHODES_DOCUMENT_IMAGES_DATA_DIR) {
    return process.env.RHODES_DOCUMENT_IMAGES_DATA_DIR;
  }
  return path.join(rhodesDataDir(), "document-images");
}
