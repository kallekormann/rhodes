import type {
  ChunkKind,
  CitationFacet,
  LibraryFileType,
  StructureFacet,
} from "@rhodes/shared/chunk-metadata";

export type ExtractedSegment = {
  text: string;
  chunk_kind: ChunkKind;
  char_offset_start: number;
  char_offset_end: number;
  citation: Partial<CitationFacet>;
  structure: Partial<StructureFacet>;
};

export type ExtractedDocument = {
  file_type: LibraryFileType;
  mime_type: string;
  extractor: string;
  full_text: string;
  segments: ExtractedSegment[];
  source_metadata?: Record<string, unknown>;
};
