import {
  EXTRACTION_VERSION,
  buildReasoningLabel,
  estimateTokens,
  makeAnchorKey,
  type ChunkMetadata,
  type ChunkKind,
} from "@rhodes/shared/chunk-metadata";
import { formatCitationLocation } from "@rhodes/shared/citation-location";
import { createHash } from "node:crypto";
import {
  LIBRARY_CHUNK_CHARS,
  LIBRARY_CHUNK_OVERLAP_CHARS,
  LIBRARY_MAX_CHUNKS_PER_FILE,
} from "@rhodes/shared/constants";

type TipTapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
};

export type DocumentPreparedChunk = {
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenEstimate: number;
  chunkMetadata: ChunkMetadata;
  embedText: string;
};

function nodeText(node: TipTapNode): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  return node.content.map(nodeText).join("");
}

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

type Segment = {
  text: string;
  chunk_kind: ChunkKind;
  heading_path: string[];
  heading_level?: number;
  paragraph_index?: number;
};

function walkTipTap(doc: TipTapNode): Segment[] {
  const segments: Segment[] = [];
  const headingPath: string[] = [];
  let paragraphIndex = 0;
  const top = doc.content ?? [];

  for (const node of top) {
    const type = node.type ?? "";
    if (type === "heading") {
      const level = Number(node.attrs?.level ?? 1);
      const text = nodeText(node).trim();
      if (!text) continue;
      headingPath.length = Math.max(0, level - 1);
      headingPath[level - 1] = text;
      segments.push({
        text,
        chunk_kind: "heading",
        heading_path: [...headingPath],
        heading_level: level,
      });
      continue;
    }

    if (type === "codeBlock") {
      const text = nodeText(node).trim();
      if (!text) continue;
      segments.push({
        text,
        chunk_kind: "code",
        heading_path: [...headingPath],
      });
      continue;
    }

    if (type === "bulletList" || type === "orderedList") {
      const text = (node.content ?? [])
        .map((item) => nodeText(item).trim())
        .filter(Boolean)
        .join("\n");
      if (!text) continue;
      paragraphIndex += 1;
      segments.push({
        text,
        chunk_kind: "list",
        heading_path: [...headingPath],
        paragraph_index: paragraphIndex,
      });
      continue;
    }

    if (type === "table") {
      const text = nodeText(node).trim();
      if (!text) continue;
      segments.push({
        text,
        chunk_kind: "table",
        heading_path: [...headingPath],
      });
      continue;
    }

    // Skip citation nodes from being embedded as prose source of self-citation noise
    if (type === "citation") continue;

    const text = nodeText(node).trim();
    if (!text) continue;
    paragraphIndex += 1;
    segments.push({
      text,
      chunk_kind: "prose",
      heading_path: [...headingPath],
      paragraph_index: paragraphIndex,
    });
  }

  return segments;
}

/** Pack adjacent short TipTap segments toward ~LIBRARY_CHUNK_CHARS. */
function packAdjacentSegments(segments: Segment[]): Segment[] {
  const packed: Segment[] = [];
  let buffer: Segment | null = null;

  const flush = () => {
    if (buffer) {
      packed.push(buffer);
      buffer = null;
    }
  };

  for (const segment of segments) {
    if (!buffer) {
      buffer = { ...segment, heading_path: [...segment.heading_path] };
      continue;
    }

    const samePath =
      buffer.heading_path.join("\0") === segment.heading_path.join("\0");
    const mergedLen = buffer.text.length + 2 + segment.text.length;
    const canPack =
      samePath &&
      buffer.chunk_kind !== "heading" &&
      segment.chunk_kind !== "heading" &&
      buffer.chunk_kind !== "code" &&
      segment.chunk_kind !== "code" &&
      mergedLen <= LIBRARY_CHUNK_CHARS;

    if (canPack) {
      buffer = {
        ...buffer,
        text: `${buffer.text}\n\n${segment.text}`,
        paragraph_index: buffer.paragraph_index ?? segment.paragraph_index,
      };
    } else {
      flush();
      buffer = { ...segment, heading_path: [...segment.heading_path] };
    }
  }

  flush();
  return packed;
}

export function chunkTipTapDocument(input: {
  documentId: string;
  title: string;
  content: Record<string, unknown> | null;
  contentPlain?: string | null;
}): DocumentPreparedChunk[] {
  const root = (input.content ?? { type: "doc", content: [] }) as TipTapNode;
  let segments = walkTipTap(root);

  if (segments.length === 0 && input.contentPlain?.trim()) {
    segments = input.contentPlain
      .split(/\n{2,}/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, i) => ({
        text,
        chunk_kind: "prose" as const,
        heading_path: [] as string[],
        paragraph_index: i + 1,
      }));
  }

  segments = packAdjacentSegments(segments);

  const prepared: DocumentPreparedChunk[] = [];
  let chunkIndex = 0;
  let offset = 0;

  for (const segment of segments) {
    if (chunkIndex >= LIBRARY_MAX_CHUNKS_PER_FILE) break;

    let remaining = segment.text;
    while (remaining.length > 0 && chunkIndex < LIBRARY_MAX_CHUNKS_PER_FILE) {
      const [piece, rest] = splitOnBoundary(remaining, LIBRARY_CHUNK_CHARS);
      if (!piece) break;

      const citation = {
        label: "",
        heading_path: segment.heading_path,
        paragraph_index: segment.paragraph_index,
      };
      citation.label =
        formatCitationLocation("document", citation) ||
        (segment.heading_path.at(-1)
          ? `§${segment.heading_path.at(-1)}`
          : `¶${segment.paragraph_index ?? chunkIndex + 1}`);

      const reasoningLabel = buildReasoningLabel(input.title, citation.label);
      const charStart = offset;
      const charEnd = offset + piece.length;
      const chunkMetadata: ChunkMetadata = {
        schema_version: "1",
        file_type: "document",
        anchor_key: makeAnchorKey(input.documentId, charStart, charEnd),
        citation,
        structure: {
          chunk_kind: segment.chunk_kind,
          char_offset_start: charStart,
          char_offset_end: charEnd,
          segment_index: chunkIndex,
          heading_level: segment.heading_level,
          parent_anchor_key:
            segment.heading_path.length > 0
              ? `${input.documentId}:heading:${segment.heading_path.join("/")}`
              : undefined,
        },
        provenance: {
          extractor: "tiptap-ast",
          extraction_version: EXTRACTION_VERSION,
          mime_type: "application/vnd.rhodes.document+json",
        },
        display: {
          source_title: input.title,
          excerpt_hint: piece.slice(0, 120),
          reasoning_label: reasoningLabel,
        },
      };

      prepared.push({
        chunkIndex,
        content: piece,
        contentHash: createHash("sha256").update(piece).digest("hex").slice(0, 32),
        tokenEstimate: estimateTokens(piece),
        chunkMetadata,
        embedText: `${reasoningLabel}\n${piece}`,
      });

      chunkIndex += 1;
      offset = charEnd;
      if (!rest) break;
      const overlapStart = Math.max(0, piece.length - LIBRARY_CHUNK_OVERLAP_CHARS);
      remaining = `${piece.slice(overlapStart)}${rest}`.trim();
      offset -= piece.length - overlapStart;
    }
  }

  return prepared;
}
