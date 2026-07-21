export const LIBRARY_FAILURE_CODES = [
  "empty_text",
  "extract_timeout",
  "extract_failed",
  "file_missing",
  "embed_unavailable",
  "embed_failed",
  "queue_failed",
  "unknown",
] as const;

export type LibraryFailureCode = (typeof LIBRARY_FAILURE_CODES)[number];

export type LibraryFailureAction = "retry" | "replace" | "remove";

export type ClassifiedLibraryFailure = {
  code: LibraryFailureCode;
  message: string;
};

const MAX_MESSAGE = 160;

const REASON_BY_CODE: Record<LibraryFailureCode, string> = {
  empty_text:
    "We couldn’t find readable text in this file (scanned image, empty, or protected).",
  extract_timeout:
    "Reading the file timed out. Large or complex files can fail on first try.",
  extract_failed: "We couldn’t read this file format cleanly.",
  file_missing:
    "The file bytes are missing from storage, so indexing can’t continue.",
  embed_unavailable: "Local AI was busy or unavailable while embedding.",
  embed_failed: "Embedding failed partway through.",
  queue_failed: "We couldn’t start the indexing job.",
  unknown: "Indexing failed unexpectedly.",
};

/** Primary labeled CTA for a failure code. */
export function libraryFailurePrimaryAction(
  code: LibraryFailureCode | null | undefined,
): { action: LibraryFailureAction; label: string } {
  switch (code) {
    case "empty_text":
      return { action: "replace", label: "Replace file" };
    case "file_missing":
      return { action: "replace", label: "Upload again" };
    case "extract_failed":
      return { action: "retry", label: "Try again" };
    case "extract_timeout":
    case "embed_unavailable":
    case "embed_failed":
    case "queue_failed":
    case "unknown":
    default:
      return { action: "retry", label: "Try again" };
  }
}

/** Whether replace/upload-again is offered as a secondary option. */
export function libraryFailureOffersReplace(
  code: LibraryFailureCode | null | undefined,
): boolean {
  return (
    code === "empty_text" ||
    code === "extract_failed" ||
    code === "file_missing"
  );
}

export function isLibraryFailureCode(value: unknown): value is LibraryFailureCode {
  return (
    typeof value === "string" &&
    (LIBRARY_FAILURE_CODES as readonly string[]).includes(value)
  );
}

function truncateMessage(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (cleaned.length <= MAX_MESSAGE) return cleaned;
  return `${cleaned.slice(0, MAX_MESSAGE - 1)}…`;
}

export function reasonForLibraryFailure(
  code: LibraryFailureCode,
  fallback?: string | null,
): string {
  if (code === "unknown" && fallback?.trim()) {
    return truncateMessage(fallback);
  }
  return REASON_BY_CODE[code];
}

/** Classify a raw worker/API error into a stable code + user message. */
export function classifyLibraryFailure(raw: unknown): ClassifiedLibraryFailure {
  const message =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : "Indexing failed unexpectedly";
  const lower = message.toLowerCase();

  if (
    lower.includes("no extractable text") ||
    lower.includes("no chunks produced") ||
    lower.includes("empty content")
  ) {
    return { code: "empty_text", message: REASON_BY_CODE.empty_text };
  }

  if (
    lower.includes("could not download") ||
    lower.includes("file bytes missing") ||
    (lower.includes("not found") && lower.includes("storage"))
  ) {
    return { code: "file_missing", message: REASON_BY_CODE.file_missing };
  }

  if (
    lower.includes("aborted") ||
    lower.includes("timeout") ||
    lower.includes("etimedout")
  ) {
    if (lower.includes("tika") || lower.includes("extract") || lower.includes("reading")) {
      return { code: "extract_timeout", message: REASON_BY_CODE.extract_timeout };
    }
    return { code: "embed_unavailable", message: REASON_BY_CODE.embed_unavailable };
  }

  if (
    lower.includes("tika") ||
    lower.includes("extraction failed") ||
    lower.includes("could not read")
  ) {
    return { code: "extract_failed", message: REASON_BY_CODE.extract_failed };
  }

  if (
    lower.includes("ollama") ||
    lower.includes("econnrefused") ||
    lower.includes("fetch failed") ||
    lower.includes("503") ||
    lower.includes("overloaded")
  ) {
    return { code: "embed_unavailable", message: REASON_BY_CODE.embed_unavailable };
  }

  if (lower.includes("embedding") || lower.includes("embed")) {
    return { code: "embed_failed", message: REASON_BY_CODE.embed_failed };
  }

  if (lower.includes("enqueue") || lower.includes("queue")) {
    return { code: "queue_failed", message: REASON_BY_CODE.queue_failed };
  }

  return {
    code: "unknown",
    message: truncateMessage(message) || REASON_BY_CODE.unknown,
  };
}

/** Metadata patch to mark a source failed with classified error. */
export function libraryFailureMetadata(
  raw: unknown,
): {
  failure_code: LibraryFailureCode;
  last_error: string;
  last_error_at: string;
} {
  const classified = classifyLibraryFailure(raw);
  return {
    failure_code: classified.code,
    last_error: classified.message,
    last_error_at: new Date().toISOString(),
  };
}

/** Metadata patch that clears failure fields on retry/success. */
export function clearLibraryFailureMetadata(): {
  failure_code: null;
  last_error: null;
  last_error_at: null;
} {
  return {
    failure_code: null,
    last_error: null,
    last_error_at: null,
  };
}
