import { EXTENSION_MIME } from "@/lib/library/schemas";

const INLINE_EXTENSIONS = new Set(["pdf", "txt", "md", "markdown"]);

export function libraryFileExtension(
  fileName: string,
  mimeType?: string | null,
): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext && EXTENSION_MIME[ext]) return ext;

  if (!mimeType) return ext ?? null;

  for (const [key, value] of Object.entries(EXTENSION_MIME)) {
    if (value === mimeType) return key;
  }

  return ext ?? null;
}

export function shouldInlineLibraryFile(
  fileName: string,
  mimeType?: string | null,
): boolean {
  const ext = libraryFileExtension(fileName, mimeType);
  return ext != null && INLINE_EXTENSIONS.has(ext);
}

export function contentTypeForLibraryFile(
  fileName: string,
  mimeType?: string | null,
): string {
  if (mimeType?.trim()) return mimeType;

  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext && EXTENSION_MIME[ext]) return EXTENSION_MIME[ext];

  return "application/octet-stream";
}

export function contentDispositionForLibraryFile(
  fileName: string,
  mimeType?: string | null,
): string {
  const mode = shouldInlineLibraryFile(fileName, mimeType) ? "inline" : "attachment";
  const safeName = fileName.replace(/["\r\n]/g, "_");
  return `${mode}; filename="${safeName}"`;
}

export function isLibraryFileAllowedByName(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return false;
  return ext in EXTENSION_MIME;
}
