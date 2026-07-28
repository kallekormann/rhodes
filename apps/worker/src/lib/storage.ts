import { createAdminObjectStorage } from "@rhodes/db/object-storage";
import { LIBRARY_BUCKET } from "@rhodes/shared/constants";

export async function downloadLibraryFile(filePath: string): Promise<Uint8Array> {
  const storage = createAdminObjectStorage();
  const bytes = await storage.get(LIBRARY_BUCKET, filePath);

  if (!bytes || bytes.length === 0) {
    throw new Error(`Could not download library file: ${filePath}`);
  }

  return bytes;
}
