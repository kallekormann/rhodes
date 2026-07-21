import { createAdminClient } from "@rhodes/db";
import { LIBRARY_BUCKET } from "@rhodes/shared/constants";
import { readLocalLibraryFile } from "./local-storage";

export async function downloadLibraryFile(filePath: string): Promise<Uint8Array> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(LIBRARY_BUCKET).download(filePath);

  if (!error && data) {
    const bytes = new Uint8Array(await data.arrayBuffer());
    // Empty blob is treated as a miss so we can fall back to local dev storage.
    if (bytes.length > 0) return bytes;
  }

  const local = await readLocalLibraryFile(filePath);
  if (local && local.length > 0) return local;

  throw new Error(
    error?.message ?? `Could not download library file: ${filePath}`,
  );
}
