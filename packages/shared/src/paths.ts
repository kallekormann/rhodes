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

/** Shared dev fallback directory for library file bytes (web upload + worker ingest). */
export function libraryFilesDataDir(): string {
  if (process.env.RHODES_LIBRARY_DATA_DIR) {
    return process.env.RHODES_LIBRARY_DATA_DIR;
  }
  const root = findMonorepoRoot(process.cwd());
  return path.join(root, ".data", "library-files");
}
