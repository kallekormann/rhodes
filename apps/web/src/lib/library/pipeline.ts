import type { LibraryEmbeddingStatus } from "./schemas";
import {
  isLibraryFailureCode,
  libraryFailurePrimaryAction,
  reasonForLibraryFailure,
  type LibraryFailureCode,
} from "@rhodes/shared/library-failure";

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

export function readLibraryFailureCode(
  metadata: Record<string, unknown> | null | undefined,
): LibraryFailureCode | null {
  const code = metadata?.failure_code;
  return isLibraryFailureCode(code) ? code : null;
}

export function readLibraryFailureMessage(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const code = readLibraryFailureCode(metadata);
  const stored =
    typeof metadata?.last_error === "string" ? metadata.last_error.trim() : "";
  if (code) return reasonForLibraryFailure(code, stored || null);
  if (stored) return stored;
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

  // Trust embedding_status=ready over a stale pipeline_stage (e.g. indexing).
  if (input.embedding_status === "ready") {
    if (stage === "analyzing") {
      return { variant: "progress", label: "Analyzing…" };
    }
    return { variant: "success", label: "Ready" };
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
  if (
    input.embedding_status === "pending" ||
    input.embedding_status === "processing"
  ) {
    return true;
  }

  if (input.embedding_status === "ready") {
    return readPipelineStage(input.metadata) === "analyzing";
  }

  return false;
}

export function librarySourceFailureCta(input: {
  embedding_status: LibraryEmbeddingStatus;
  metadata?: Record<string, unknown> | null;
}): { action: "retry" | "replace" | "remove"; label: string } | null {
  if (input.embedding_status !== "failed") return null;
  return libraryFailurePrimaryAction(readLibraryFailureCode(input.metadata));
}
