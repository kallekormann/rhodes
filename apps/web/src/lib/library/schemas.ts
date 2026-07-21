import { z } from "zod";
import { LIBRARY_MAX_UPLOAD_BYTES } from "@rhodes/shared/constants";

export const libraryEmbeddingStatusSchema = z.enum([
  "pending",
  "processing",
  "ready",
  "failed",
]);

export type LibraryEmbeddingStatus = z.infer<typeof libraryEmbeddingStatusSchema>;

export const libraryFileTypeFilterSchema = z.enum([
  "all",
  "pdf",
  "docx",
  "ppt",
  "xls",
  "txt",
  "md",
  "rtf",
]);

export type LibraryFileTypeFilter = z.infer<typeof libraryFileTypeFilterSchema>;

export const listLibraryQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().trim().max(200).optional().default(""),
  file_type: libraryFileTypeFilterSchema.optional().default("all"),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** MIME / stored file_type patterns for coarse filter buckets. */
export const LIBRARY_FILE_TYPE_PATTERNS: Record<
  Exclude<LibraryFileTypeFilter, "all">,
  string[]
> = {
  pdf: ["%pdf%"],
  docx: ["%word%", "%msword%", "%docx%"],
  ppt: ["%presentation%", "%powerpoint%", "%ppt%"],
  xls: ["%sheet%", "%excel%", "%xls%"],
  txt: ["%text/plain%", "text/plain", "%txt%"],
  md: ["%markdown%", "%md%"],
  rtf: ["%rtf%"],
};

const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  rtf: "application/rtf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
};

export { EXTENSION_MIME };

const ALLOWED_MIME_TYPES = new Set([
  ...Object.values(EXTENSION_MIME),
  "text/x-markdown",
  "text/rtf",
]);

export const LIBRARY_FILE_ACCEPT =
  ".pdf,.docx,.ppt,.pptx,.xls,.xlsx,.rtf,.txt,.md,.markdown," +
  Object.values(EXTENSION_MIME).join(",");

export const LIBRARY_FILE_LABEL =
  "PDF, DOCX, PPT, XLS, RTF, TXT, or Markdown";

export function resolveLibraryMimeType(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext && EXTENSION_MIME[ext]) {
    if (!file.type || !ALLOWED_MIME_TYPES.has(file.type)) {
      return EXTENSION_MIME[ext];
    }
  }

  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) {
    return file.type;
  }

  if (!ext) return null;
  return EXTENSION_MIME[ext] ?? null;
}

export function isLibraryFileAllowed(file: File): boolean {
  return resolveLibraryMimeType(file) !== null;
}

export { LIBRARY_MAX_UPLOAD_BYTES };

export type LibrarySourceRecord = {
  id: string;
  workspace_id: string;
  uploaded_by: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  summary: string | null;
  embedding_status: LibraryEmbeddingStatus;
  metadata?: {
    byte_size?: number;
    pipeline_stage?: string;
    pipeline_updated_at?: string;
    chunk_count?: number;
    failure_code?: string;
    last_error?: string;
    last_error_at?: string;
  } | null;
  created_at: string;
};

export type LibraryListFilters = {
  q: string;
  fileType: LibraryFileTypeFilter;
  from: string | null;
  to: string | null;
};
