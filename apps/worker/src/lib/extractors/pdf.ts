import { extractTextWithTika } from "../tika";
import type { ExtractedDocument, ExtractedSegment } from "./types";

/** PDF: prefer form-feed page boundaries from Tika plain text. */
export async function extractPdf(
  bytes: Uint8Array,
  mimeType: string,
): Promise<ExtractedDocument> {
  const text = (await extractTextWithTika(bytes, mimeType)).replace(/\r\n/g, "\n");
  const pages = text.includes("\f") ? text.split("\f") : [text];
  const segments: ExtractedSegment[] = [];
  let offset = 0;
  let paragraphIndex = 0;

  pages.forEach((pageText, pageIdx) => {
    const pageNumber = pageIdx + 1;
    const blocks = pageText.split(/\n{2,}/);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const start = text.indexOf(trimmed, offset);
      const end = start >= 0 ? start + trimmed.length : offset + trimmed.length;
      paragraphIndex += 1;
      segments.push({
        text: trimmed,
        chunk_kind: "prose",
        char_offset_start: Math.max(0, start),
        char_offset_end: end,
        citation: {
          page_number: pageNumber,
          paragraph_index: paragraphIndex,
          heading_path: [],
        },
        structure: { segment_index: segments.length },
      });
      offset = end;
    }
  });

  return {
    file_type: "pdf",
    mime_type: mimeType,
    extractor: text.includes("\f") ? "pdf-tika-pages" : "pdf-tika-plain-fallback",
    full_text: text.replace(/\f/g, "\n\n").trim(),
    segments,
    source_metadata: { page_count: pages.length },
  };
}
