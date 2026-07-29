export const STORAGE_ALERT_LOG_PREFIX = "[rhodes:storage-alert]" as const;

export type StorageAlertOperation = "download" | "upload" | "remove" | "verify";

const STORAGE_ERROR_MARKERS = [
  "storage api",
  "storage service",
  "object not found",
  "the resource was not found",
  "bucket not found",
  "invalidjwt",
  "signature verification failed",
  "could not download library file",
  "upload failed",
  "storage backend",
  "minio",
  "s3",
] as const;

export function isStorageApiError(raw: unknown): boolean {
  const message =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : "";
  const lower = message.toLowerCase();
  return STORAGE_ERROR_MARKERS.some((marker) => lower.includes(marker));
}

export function logWorkerStorageAlert(
  operation: StorageAlertOperation,
  context: Record<string, unknown>,
  error: unknown,
): void {
  const payload = {
    at: new Date().toISOString(),
    operation,
    ...context,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { message: String(error) },
  };
  console.error(STORAGE_ALERT_LOG_PREFIX, JSON.stringify(payload));
}
