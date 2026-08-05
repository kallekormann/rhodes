import { isLibraryOrigin } from "@/lib/library/preview";

export type TipTapNode = {
  type?: string;
  attrs?: Record<string, unknown> | null;
  content?: TipTapNode[];
};

export type CitationRef = {
  sourceRefId: string;
  originType: string;
  sourceTitle: string | null;
};

export type CitationEdge = {
  id: string;
  source: string;
  target: string;
  fieldKey: "citation";
  fieldLabel: "Citation";
  kind: "citation";
};

/** Depth-first walk of TipTap JSON collecting citation nodes. */
export function walkCitationNodes(content: unknown): CitationRef[] {
  if (!content || typeof content !== "object") return [];
  const root = content as TipTapNode;
  const found: CitationRef[] = [];

  const visit = (node: TipTapNode) => {
    if (node.type === "citation") {
      const attrs = node.attrs ?? {};
      const sourceRefId = String(attrs.sourceRefId ?? attrs.sourceId ?? "").trim();
      if (sourceRefId) {
        found.push({
          sourceRefId,
          originType: String(attrs.originType ?? "source_chunk"),
          sourceTitle:
            typeof attrs.sourceTitle === "string" && attrs.sourceTitle.trim()
              ? attrs.sourceTitle.trim()
              : null,
        });
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) visit(child);
    }
  };

  visit(root);
  return found;
}

/**
 * Resolve a citation ref to a `library_sources.id`.
 * - Direct hit when `sourceRefId` is already a library source id
 * - Chunk ids resolve via optional `chunkToSourceId` map
 */
export function resolveCitationLibrarySourceId(
  ref: CitationRef,
  librarySourceIds: Set<string>,
  chunkToSourceId?: Map<string, string> | null,
): string | null {
  if (!isLibraryOrigin(ref.originType)) return null;

  if (librarySourceIds.has(ref.sourceRefId)) {
    return ref.sourceRefId;
  }

  const viaChunk = chunkToSourceId?.get(ref.sourceRefId);
  if (viaChunk && librarySourceIds.has(viaChunk)) {
    return viaChunk;
  }

  return null;
}

/** Build document→library citation edges from TipTap bodies. */
export function buildCitationEdges(
  documents: { id: string; content: unknown }[],
  librarySourceIds: Set<string>,
  chunkToSourceId?: Map<string, string> | null,
): CitationEdge[] {
  const edges: CitationEdge[] = [];
  const seen = new Set<string>();

  for (const doc of documents) {
    for (const ref of walkCitationNodes(doc.content)) {
      const libraryId = resolveCitationLibrarySourceId(
        ref,
        librarySourceIds,
        chunkToSourceId,
      );
      if (!libraryId) continue;
      const id = `${doc.id}->${libraryId}:citation`;
      if (seen.has(id)) continue;
      seen.add(id);
      edges.push({
        id,
        source: doc.id,
        target: libraryId,
        fieldKey: "citation",
        fieldLabel: "Citation",
        kind: "citation",
      });
    }
  }

  return edges;
}
