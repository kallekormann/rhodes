import { extractLibraryDocument } from "./extractors/router";

/** @deprecated Prefer extractLibraryDocument — kept for callers expecting plain text. */
export async function extractLibraryText(
  bytes: Uint8Array,
  mimeType: string,
  fileName?: string | null,
): Promise<string> {
  const extracted = await extractLibraryDocument(bytes, mimeType, fileName);
  return extracted.full_text;
}

export { extractLibraryDocument };
