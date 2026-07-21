/** Canonical chunk metadata shared by library + workspace document chunks. */

export const CHUNK_METADATA_SCHEMA_VERSION = "1" as const;

export type LibraryFileType =
  | "pdf"
  | "docx"
  | "ppt"
  | "pptx"
  | "xls"
  | "xlsx"
  | "rtf"
  | "txt"
  | "md"
  | "document";

export type ChunkKind =
  | "prose"
  | "heading"
  | "list"
  | "table"
  | "slide"
  | "sheet_rows"
  | "code";

export type CitationFacet = {
  label: string;
  heading_path: string[];
  page_number?: number;
  slide_number?: number;
  sheet_name?: string;
  paragraph_index?: number;
  row_range?: { start: number; end: number };
  line_range?: { start: number; end: number };
};

export type StructureFacet = {
  chunk_kind: ChunkKind;
  char_offset_start: number;
  char_offset_end: number;
  segment_index: number;
  parent_anchor_key?: string;
  heading_level?: number;
  language?: string;
};

export type ProvenanceFacet = {
  extractor: string;
  extraction_version: string;
  mime_type: string;
};

export type DisplayFacet = {
  source_title: string;
  excerpt_hint?: string;
  reasoning_label: string;
};

export type ChunkMetadata = {
  schema_version: typeof CHUNK_METADATA_SCHEMA_VERSION;
  file_type: LibraryFileType;
  anchor_key: string;
  citation: CitationFacet;
  structure: StructureFacet;
  provenance: ProvenanceFacet;
  display: DisplayFacet;
};

export const EXTRACTION_VERSION = "2026-07-v1";

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function makeAnchorKey(
  ownerId: string,
  charStart: number,
  charEnd: number,
): string {
  return `${ownerId}:${charStart}-${charEnd}`;
}

export function buildReasoningLabel(
  sourceTitle: string,
  citationLabel: string,
): string {
  const title = sourceTitle.trim() || "Source";
  const citation = citationLabel.trim();
  if (!citation) return title;
  return `${title} — ${citation}`;
}
