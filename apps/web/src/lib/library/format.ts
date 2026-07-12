export function formatLibraryFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatLibraryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function embeddingStatusToPill(status: string): {
  variant: "success" | "progress" | "error";
  label: string;
} {
  switch (status) {
    case "ready":
      return { variant: "success", label: "Ready" };
    case "processing":
      return { variant: "progress", label: "Indexing…" };
    case "pending":
      return { variant: "progress", label: "Queued" };
    case "failed":
      return { variant: "error", label: "Failed" };
    default:
      return { variant: "progress", label: "Pending" };
  }
}
