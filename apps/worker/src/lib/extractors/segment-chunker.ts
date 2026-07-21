import { createHash } from "node:crypto";
import {
  EXTRACTION_VERSION,
  buildReasoningLabel,
  estimateTokens,
  makeAnchorKey,
  type ChunkMetadata,
  type LibraryFileType,
} from "@rhodes/shared/chunk-metadata";
import { formatCitationLocation } from "@rhodes/shared/citation-location";
import {
  LIBRARY_CHUNK_CHARS,
  LIBRARY_CHUNK_OVERLAP_CHARS,
  LIBRARY_MAX_CHUNKS_PER_FILE,
} from "@rhodes/shared/constants";
import type { ExtractedDocument, ExtractedSegment } from "./types";

export type PreparedChunk = {
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  contentHash: string;
  tokenEstimate: number;
  chunkMetadata: ChunkMetadata;
  embedText: string;
};

export type SegmentsToChunksResult = {
  chunks: PreparedChunk[];
  truncated: boolean;
};

const PACK_SOFT_RATIO = 0.6;
const MAX_PACK_TARGET_CHARS = 16_000;

function splitOnBoundary(text: string, maxChars: number): [string, string] {
  if (text.length <= maxChars) return [text, ""];

  const window = text.slice(0, maxChars + 1);
  const breakCandidates = [
    window.lastIndexOf("\n\n"),
    window.lastIndexOf("\n"),
    window.lastIndexOf(". "),
    window.lastIndexOf(" "),
  ].filter((index) => index > maxChars * 0.5);

  const splitAt =
    breakCandidates.length > 0 ? Math.max(...breakCandidates) : maxChars;

  return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()];
}

function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function pageRangeLabel(pages: number[]): string | null {
  if (pages.length === 0) return null;
  const min = Math.min(...pages);
  const max = Math.max(...pages);
  return min === max ? `p.${min}` : `p.${min}–${max}`;
}

function slideRangeLabel(slides: number[]): string | null {
  if (slides.length === 0) return null;
  const min = Math.min(...slides);
  const max = Math.max(...slides);
  return min === max ? `Slide ${min}` : `Slides ${min}–${max}`;
}

function mergePackedCitation(
  fileType: LibraryFileType,
  members: ExtractedSegment[],
): ChunkMetadata["citation"] {
  const first = members[0]?.citation ?? {};
  const pages = members
    .map((m) => m.citation.page_number)
    .filter((n): n is number => typeof n === "number");
  const slides = members
    .map((m) => m.citation.slide_number)
    .filter((n): n is number => typeof n === "number");

  const pageLabel = pageRangeLabel(pages);
  const slideLabel = slideRangeLabel(slides);

  const base = {
    heading_path: first.heading_path ?? [],
    page_number: pages.length > 0 ? Math.min(...pages) : first.page_number,
    slide_number: slides.length > 0 ? Math.min(...slides) : first.slide_number,
    sheet_name: first.sheet_name,
    paragraph_index: first.paragraph_index,
    row_range: first.row_range,
    line_range: first.line_range,
  };

  const formatted = formatCitationLocation(fileType, base);
  const rangeHint = pageLabel ?? slideLabel;
  const label =
    rangeHint && pages.length > 1
      ? rangeHint
      : first.label?.trim() || formatted || rangeHint || "";

  return { ...base, label, heading_path: base.heading_path };
}

function shouldSoftFlush(
  bufferLen: number,
  next: ExtractedSegment,
  targetChars: number,
): boolean {
  if (bufferLen < targetChars * PACK_SOFT_RATIO) return false;
  if (next.chunk_kind === "heading") return true;
  if (next.citation.page_number != null || next.citation.slide_number != null) {
    return true;
  }
  if (next.citation.sheet_name) return true;
  return false;
}

function buildChunkFromText(
  text: string,
  members: ExtractedSegment[],
  fileType: LibraryFileType,
  sourceId: string,
  sourceTitle: string,
  mimeType: string,
  extractor: string,
  chunkIndex: number,
  charStart: number,
): PreparedChunk {
  const citation = mergePackedCitation(fileType, members);
  const reasoningLabel = buildReasoningLabel(sourceTitle, citation.label);
  const charEnd = charStart + text.length;
  const first = members[0];

  const chunkMetadata: ChunkMetadata = {
    schema_version: "1",
    file_type: fileType,
    anchor_key: makeAnchorKey(sourceId, charStart, charEnd),
    citation,
    structure: {
      chunk_kind: first?.chunk_kind ?? "prose",
      char_offset_start: charStart,
      char_offset_end: charEnd,
      segment_index: first?.structure.segment_index ?? chunkIndex,
      parent_anchor_key: first?.structure.parent_anchor_key,
      heading_level: first?.structure.heading_level,
      language: first?.structure.language,
    },
    provenance: {
      extractor,
      extraction_version: EXTRACTION_VERSION,
      mime_type: mimeType,
    },
    display: {
      source_title: sourceTitle,
      excerpt_hint: text.slice(0, 120),
      reasoning_label: reasoningLabel,
    },
  };

  return {
    chunkIndex,
    content: text,
    pageNumber: citation.page_number ?? null,
    contentHash: hashContent(text),
    tokenEstimate: estimateTokens(text),
    chunkMetadata,
    embedText: `${reasoningLabel}\n${text}`,
  };
}

function flushBufferAsChunks(
  bufferText: string,
  members: ExtractedSegment[],
  fileType: LibraryFileType,
  sourceId: string,
  sourceTitle: string,
  mimeType: string,
  extractor: string,
  startIndex: number,
  targetChars: number,
  charStart: number,
): PreparedChunk[] {
  const trimmed = bufferText.trim();
  if (!trimmed || members.length === 0) return [];

  const out: PreparedChunk[] = [];
  let remaining = trimmed;
  let localIndex = 0;
  let offsetCursor = charStart;

  while (remaining.length > 0) {
    const [piece, rest] = splitOnBoundary(remaining, targetChars);
    if (!piece) break;

    out.push(
      buildChunkFromText(
        piece,
        members,
        fileType,
        sourceId,
        sourceTitle,
        mimeType,
        extractor,
        startIndex + localIndex,
        offsetCursor,
      ),
    );

    localIndex += 1;
    if (!rest) break;

    const overlapStart = Math.max(0, piece.length - LIBRARY_CHUNK_OVERLAP_CHARS);
    const overlap = piece.slice(overlapStart);
    remaining = `${overlap}${rest}`.trim();
    offsetCursor = offsetCursor + piece.length - overlap.length;
  }

  return out;
}

/** Pack adjacent short segments into ~targetChars chunks. */
export function packSegmentsToChunks(
  segments: ExtractedSegment[],
  input: {
    sourceId: string;
    sourceTitle: string;
    fileType: LibraryFileType;
    mimeType: string;
    extractor: string;
    targetChars?: number;
  },
): PreparedChunk[] {
  const targetChars = input.targetChars ?? LIBRARY_CHUNK_CHARS;
  const prepared: PreparedChunk[] = [];
  let bufferParts: string[] = [];
  let bufferMembers: ExtractedSegment[] = [];
  let bufferStart = 0;

  const flush = () => {
    if (bufferMembers.length === 0) return;
    const text = bufferParts.join("\n\n");
    const pieces = flushBufferAsChunks(
      text,
      bufferMembers,
      input.fileType,
      input.sourceId,
      input.sourceTitle,
      input.mimeType,
      input.extractor,
      prepared.length,
      targetChars,
      bufferStart,
    );
    prepared.push(...pieces);
    bufferParts = [];
    bufferMembers = [];
  };

  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) continue;

    const currentLen = bufferParts.join("\n\n").length;
    const nextLen = currentLen === 0 ? text.length : currentLen + 2 + text.length;

    if (
      bufferMembers.length > 0 &&
      (nextLen > targetChars || shouldSoftFlush(currentLen, segment, targetChars))
    ) {
      flush();
    }

    if (bufferMembers.length === 0) {
      bufferStart = segment.char_offset_start;
    }
    bufferParts.push(text);
    bufferMembers.push(segment);

    // Oversized single segment: flush immediately so splitOnBoundary can run.
    if (text.length > targetChars) {
      flush();
    }
  }

  flush();
  return prepared;
}

function packWithCap(
  segments: ExtractedSegment[],
  input: {
    sourceId: string;
    sourceTitle: string;
    fileType: LibraryFileType;
    mimeType: string;
    extractor: string;
  },
): SegmentsToChunksResult {
  let target = LIBRARY_CHUNK_CHARS;
  let chunks = packSegmentsToChunks(segments, { ...input, targetChars: target });
  let truncated = false;

  while (
    chunks.length > LIBRARY_MAX_CHUNKS_PER_FILE &&
    target < MAX_PACK_TARGET_CHARS
  ) {
    target *= 2;
    chunks = packSegmentsToChunks(segments, { ...input, targetChars: target });
  }

  if (chunks.length > LIBRARY_MAX_CHUNKS_PER_FILE) {
    chunks = chunks.slice(0, LIBRARY_MAX_CHUNKS_PER_FILE).map((chunk, index) => ({
      ...chunk,
      chunkIndex: index,
    }));
    truncated = true;
  }

  return { chunks, truncated };
}

/** Turn structured segments into DB-ready chunks with rich metadata. */
export function segmentsToChunks(
  extracted: ExtractedDocument,
  input: { sourceId: string; sourceTitle: string },
): SegmentsToChunksResult {
  const base = {
    sourceId: input.sourceId,
    sourceTitle: input.sourceTitle,
    fileType: extracted.file_type,
    mimeType: extracted.mime_type,
    extractor: extracted.extractor,
  };

  if (extracted.segments.length > 0) {
    return packWithCap(extracted.segments, base);
  }

  if (extracted.full_text.trim()) {
    const synthetic: ExtractedSegment = {
      text: extracted.full_text,
      chunk_kind: "prose",
      char_offset_start: 0,
      char_offset_end: extracted.full_text.length,
      citation: {},
      structure: { segment_index: 0 },
    };
    return packWithCap([synthetic], base);
  }

  return { chunks: [], truncated: false };
}
