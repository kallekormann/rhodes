import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AVATAR_BUCKET,
  DOCUMENT_IMAGES_BUCKET,
  LIBRARY_BUCKET,
} from "@rhodes/shared/constants";
import {
  avatarsDataDir,
  documentImagesDataDir,
  libraryFilesDataDir,
} from "@rhodes/shared/paths";
import type {
  RhodesObjectStorage,
  StoragePutInput,
} from "@rhodes/shared/storage-adapter";

const BUCKET_ROOT: Record<string, () => string> = {
  [LIBRARY_BUCKET]: libraryFilesDataDir,
  [DOCUMENT_IMAGES_BUCKET]: documentImagesDataDir,
  [AVATAR_BUCKET]: avatarsDataDir,
};

function resolveBucketPath(bucket: string, storagePath: string): string {
  const rootFactory = BUCKET_ROOT[bucket];
  if (!rootFactory) {
    throw new Error(`No local storage root configured for bucket: ${bucket}`);
  }

  const root = rootFactory();
  const normalized = path
    .normalize(storagePath)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(root, normalized);
  if (!full.startsWith(root)) {
    throw new Error(`Invalid storage path for bucket ${bucket}`);
  }
  return full;
}

/** Dev-only filesystem fallback for known Rhodes buckets. */
export class LocalFilesystemObjectStorage implements RhodesObjectStorage {
  async put(input: StoragePutInput): Promise<void> {
    const full = resolveBucketPath(input.bucket, input.path);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, input.bytes);
  }

  async get(bucket: string, objectPath: string): Promise<Uint8Array | null> {
    try {
      const full = resolveBucketPath(bucket, objectPath);
      return new Uint8Array(await readFile(full));
    } catch {
      return null;
    }
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(async (objectPath) => {
        try {
          await unlink(resolveBucketPath(bucket, objectPath));
        } catch {
          // Missing local file is fine when primary storage held the object.
        }
      }),
    );
  }

  async signedUrl(): Promise<string | null> {
    return null;
  }
}
