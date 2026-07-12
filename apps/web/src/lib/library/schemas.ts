import { z } from "zod";
import { LIBRARY_MAX_UPLOAD_BYTES } from "@rhodes/shared/constants";

export const libraryEmbeddingStatusSchema = z.enum([
  "pending",
  "processing",
  "ready",
  "failed",
]);

export type LibraryEmbeddingStatus = z.infer<typeof libraryEmbeddingStatusSchema>;

export const listLibraryQuerySchema = z.object({
  workspace_id: z.string().uuid(),
});

const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
};

const ALLOWED_MIME_TYPES = new Set([
  ...Object.values(EXTENSION_MIME),
  "text/x-markdown",
]);

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
  metadata?: { byte_size?: number } | null;
  created_at: string;
};
