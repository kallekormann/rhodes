import type { ExtractedDocument, ExtractedSegment } from "./types";

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false })
    .decode(bytes)
    .replace(/\u0000/g, "");
}

/** Markdown: track heading path, preserve code fences. */
export function extractMarkdown(
  bytes: Uint8Array,
  mimeType: string,
): ExtractedDocument {
  const text = decodeUtf8(bytes).replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const segments: ExtractedSegment[] = [];
  const headingPath: string[] = [];
  let paragraphIndex = 0;
  let buffer: string[] = [];
  let bufferStartLine = 1;
  let inCode = false;
  let offset = 0;
  let bufferStartOffset = 0;

  const flushProse = (endOffset: number, endLine: number) => {
    const body = buffer.join("\n").trim();
    if (!body) {
      buffer = [];
      return;
    }
    paragraphIndex += 1;
    segments.push({
      text: body,
      chunk_kind: inCode ? "code" : "prose",
      char_offset_start: bufferStartOffset,
      char_offset_end: endOffset,
      citation: {
        heading_path: [...headingPath],
        paragraph_index: paragraphIndex,
        line_range: { start: bufferStartLine, end: endLine },
      },
      structure: {
        segment_index: segments.length,
        heading_level: headingPath.length || undefined,
      },
    });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineStart = offset;
    const lineEnd = offset + line.length + (i < lines.length - 1 ? 1 : 0);

    if (line.trim().startsWith("```")) {
      if (inCode) {
        buffer.push(line);
        flushProse(lineEnd, i + 1);
        inCode = false;
      } else {
        flushProse(lineStart, i);
        inCode = true;
        bufferStartLine = i + 1;
        bufferStartOffset = lineStart;
        buffer = [line];
      }
      offset = lineEnd;
      continue;
    }

    if (inCode) {
      if (buffer.length === 0) {
        bufferStartLine = i + 1;
        bufferStartOffset = lineStart;
      }
      buffer.push(line);
      offset = lineEnd;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushProse(lineStart, i);
      const level = heading[1].length;
      const title = heading[2].trim();
      headingPath.length = level - 1;
      headingPath[level - 1] = title;
      segments.push({
        text: title,
        chunk_kind: "heading",
        char_offset_start: lineStart,
        char_offset_end: lineEnd,
        citation: {
          heading_path: [...headingPath],
          paragraph_index: paragraphIndex,
          line_range: { start: i + 1, end: i + 1 },
        },
        structure: {
          segment_index: segments.length,
          heading_level: level,
        },
      });
      offset = lineEnd;
      continue;
    }

    if (!line.trim()) {
      flushProse(lineStart, i);
      offset = lineEnd;
      continue;
    }

    if (buffer.length === 0) {
      bufferStartLine = i + 1;
      bufferStartOffset = lineStart;
    }
    buffer.push(line);
    offset = lineEnd;
  }

  flushProse(offset, lines.length);

  return {
    file_type: "md",
    mime_type: mimeType,
    extractor: "md-ast",
    full_text: text.trim(),
    segments,
  };
}

/** Plain text / RTF fallback: blank-line paragraphs. */
export function extractPlaintext(
  bytes: Uint8Array,
  mimeType: string,
  fileType: "txt" | "rtf",
  extractor: string,
): ExtractedDocument {
  const text = decodeUtf8(bytes).replace(/\r\n/g, "\n").trim();
  const blocks = text.split(/\n{2,}/);
  const segments: ExtractedSegment[] = [];
  let cursor = 0;
  let paragraphIndex = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      cursor += block.length + 2;
      continue;
    }
    const start = text.indexOf(trimmed, cursor);
    const end = start + trimmed.length;
    paragraphIndex += 1;
    const lineStart = text.slice(0, start).split("\n").length;
    const lineEnd = text.slice(0, end).split("\n").length;
    segments.push({
      text: trimmed,
      chunk_kind: "prose",
      char_offset_start: start,
      char_offset_end: end,
      citation: {
        paragraph_index: paragraphIndex,
        line_range: { start: lineStart, end: lineEnd },
        heading_path: [],
      },
      structure: { segment_index: segments.length },
    });
    cursor = end;
  }

  return {
    file_type: fileType,
    mime_type: mimeType,
    extractor,
    full_text: text,
    segments,
  };
}
