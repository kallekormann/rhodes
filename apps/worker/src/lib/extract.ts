import { extractTextWithTika } from "./tika";

const PLAIN_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

function decodeUtf8Text(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false })
    .decode(bytes)
    .replace(/\u0000/g, "")
    .trim();
}

export async function extractLibraryText(
  bytes: Uint8Array,
  mimeType: string,
): Promise<string> {
  if (PLAIN_TEXT_MIME_TYPES.has(mimeType)) {
    return decodeUtf8Text(bytes);
  }

  return extractTextWithTika(bytes, mimeType);
}
