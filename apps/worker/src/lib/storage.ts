import { createAdminClient } from "@rhodes/db";
import { LIBRARY_BUCKET } from "@rhodes/shared/constants";
import { readLocalLibraryFile } from "./local-storage";

export async function downloadLibraryFile(filePath: string): Promise<Uint8Array> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(LIBRARY_BUCKET).download(filePath);

  if (!error && data) {
    return new Uint8Array(await data.arrayBuffer());
  }

  const local = await readLocalLibraryFile(filePath);
  if (local) return local;

  throw new Error(error?.message ?? `Could not download library file: ${filePath}`);
}
