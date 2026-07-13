import type { LibraryEmbeddingStatus } from "./schemas";

export type LibraryPipelineStage =
  | "queued"
  | "reading"
  | "indexing"
  | "analyzing"
  | "ready"
  | "failed";

export function readPipelineStage(
  metadata: Record<string, unknown> | null | undefined,
): LibraryPipelineStage | null {
  const stage = metadata?.pipeline_stage;
  if (
    stage === "queued" ||
    stage === "reading" ||
    stage === "indexing" ||
    stage === "analyzing" ||
    stage === "ready" ||
    stage === "failed"
  ) {
    return stage;
  }
  return null;
}

export function librarySourceStatusToPill(input: {
  embedding_status: LibraryEmbeddingStatus;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
}): {
  variant: "success" | "progress" | "error";
  label: string;
} {
  const stage = readPipelineStage(input.metadata);

  if (input.embedding_status === "failed" || stage === "failed") {
    return { variant: "error", label: "Failed" };
  }

  if (stage === "reading") {
    return { variant: "progress", label: "Reading file…" };
  }

  if (stage === "indexing") {
    return { variant: "progress", label: "Indexing…" };
  }

  if (stage === "analyzing") {
    return { variant: "progress", label: "Analyzing…" };
  }

  if (input.embedding_status === "ready") {
    if (!input.summary && stage !== "ready") {
      return { variant: "progress", label: "Analyzing…" };
    }
    return { variant: "success", label: "Ready" };
  }

  if (stage === "queued" || input.embedding_status === "pending") {
    return { variant: "progress", label: "Queued…" };
  }

  if (input.embedding_status === "processing") {
    return { variant: "progress", label: "Indexing…" };
  }

  return { variant: "progress", label: "Pending" };
}

export function librarySourceIsInFlight(input: {
  embedding_status: LibraryEmbeddingStatus;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (input.embedding_status === "pending" || input.embedding_status === "processing") {
    return true;
  }

  const stage = readPipelineStage(input.metadata);
  return stage === "queued" || stage === "reading" || stage === "indexing" || stage === "analyzing";
}
