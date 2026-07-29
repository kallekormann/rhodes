import { createAdminObjectStorage } from "@rhodes/db/object-storage";
import { LIBRARY_BUCKET } from "@rhodes/shared/constants";
import {
  isStorageApiError,
  logWorkerStorageAlert,
} from "@rhodes/shared/storage-alert";

export class LibraryStorageDownloadError extends Error {
  constructor(
    message: string,
    readonly filePath: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LibraryStorageDownloadError";
  }
}

export async function downloadLibraryFile(filePath: string): Promise<Uint8Array> {
  const storage = createAdminObjectStorage();

  try {
    const bytes = await storage.get(LIBRARY_BUCKET, filePath);

    if (!bytes || bytes.length === 0) {
      const error = new LibraryStorageDownloadError(
        `Could not download library file: ${filePath}`,
        filePath,
      );
      logWorkerStorageAlert("download", { filePath, empty: true }, error);
      throw error;
    }

    return bytes;
  } catch (error) {
    if (isStorageApiError(error) || error instanceof LibraryStorageDownloadError) {
      logWorkerStorageAlert("download", { filePath }, error);
    }
    if (error instanceof LibraryStorageDownloadError) {
      throw error;
    }
    throw new LibraryStorageDownloadError(
      `Could not download library file: ${filePath}`,
      filePath,
      error,
    );
  }
}
