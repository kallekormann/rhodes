import { extractTextWithTika } from "../tika";
import type { ExtractedDocument, ExtractedSegment } from "./types";

/** PPT/PPTX: split on blank-line groups heuristically as slides. */
export async function extractPresentation(
  bytes: Uint8Array,
  mimeType: string,
  fileType: "ppt" | "pptx",
): Promise<ExtractedDocument> {
  const text = (await extractTextWithTika(bytes, mimeType))
    .replace(/\r\n/g, "\n")
    .trim();

  // Common Tika / exporter slide separators
  const rawSlides = text
    .split(/\n{3,}|\n---+\n|\f/)
    .map((s) => s.trim())
    .filter(Boolean);

  const slides = rawSlides.length > 0 ? rawSlides : [text];
  const segments: ExtractedSegment[] = [];
  let offset = 0;

  slides.forEach((slideText, idx) => {
    const slideNumber = idx + 1;
    const firstLine = slideText.split("\n").find((l) => l.trim())?.trim() ?? "";
    const title =
      firstLine.length > 0 && firstLine.length < 120 ? firstLine : `Slide ${slideNumber}`;
    segments.push({
      text: slideText,
      chunk_kind: "slide",
      char_offset_start: offset,
      char_offset_end: offset + slideText.length,
      citation: {
        slide_number: slideNumber,
        heading_path: [title],
      },
      structure: { segment_index: segments.length },
    });
    offset += slideText.length + 2;
  });

  return {
    file_type: fileType,
    mime_type: mimeType,
    extractor: "presentation-tika-slides",
    full_text: text,
    segments,
    source_metadata: { slide_count: slides.length },
  };
}
