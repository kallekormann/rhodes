import { describe, expect, it } from "vitest";
import {
  buildCitationEdges,
  resolveCitationLibrarySourceId,
  walkCitationNodes,
} from "@/lib/views/citation-graph";

const tipTapWithCitation = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Intro" }],
    },
    {
      type: "citation",
      attrs: {
        sourceRefId: "lib-1",
        originType: "library",
        sourceTitle: "Report.pdf",
        excerpt: "Quote",
      },
    },
    {
      type: "blockquote",
      content: [
        {
          type: "citation",
          attrs: {
            sourceId: "chunk-9",
            originType: "source_chunk",
            sourceTitle: "Paper",
          },
        },
      ],
    },
  ],
};

describe("walkCitationNodes", () => {
  it("collects nested citation nodes", () => {
    const refs = walkCitationNodes(tipTapWithCitation);
    expect(refs).toEqual([
      {
        sourceRefId: "lib-1",
        originType: "library",
        sourceTitle: "Report.pdf",
      },
      {
        sourceRefId: "chunk-9",
        originType: "source_chunk",
        sourceTitle: "Paper",
      },
    ]);
  });

  it("returns empty for missing content", () => {
    expect(walkCitationNodes(null)).toEqual([]);
    expect(walkCitationNodes({ type: "doc", content: [] })).toEqual([]);
  });
});

describe("resolveCitationLibrarySourceId", () => {
  const sources = new Set(["lib-1", "lib-2"]);

  it("maps library origin when source id is known", () => {
    expect(
      resolveCitationLibrarySourceId(
        { sourceRefId: "lib-1", originType: "library", sourceTitle: null },
        sources,
      ),
    ).toBe("lib-1");
  });

  it("resolves chunk ids via map", () => {
    const chunks = new Map([["chunk-9", "lib-2"]]);
    expect(
      resolveCitationLibrarySourceId(
        { sourceRefId: "chunk-9", originType: "source_chunk", sourceTitle: null },
        sources,
        chunks,
      ),
    ).toBe("lib-2");
  });

  it("ignores document origins", () => {
    expect(
      resolveCitationLibrarySourceId(
        { sourceRefId: "doc-1", originType: "document", sourceTitle: null },
        sources,
      ),
    ).toBeNull();
  });
});

describe("buildCitationEdges", () => {
  it("emits unique document→library citation edges", () => {
    const sources = new Set(["lib-1", "lib-2"]);
    const chunks = new Map([["chunk-9", "lib-2"]]);
    const edges = buildCitationEdges(
      [
        { id: "doc-a", content: tipTapWithCitation },
        { id: "doc-a", content: tipTapWithCitation },
      ],
      sources,
      chunks,
    );
    // Same doc processed twice — edges still unique
    expect(edges).toEqual([
      {
        id: "doc-a->lib-1:citation",
        source: "doc-a",
        target: "lib-1",
        fieldKey: "citation",
        fieldLabel: "Citation",
        kind: "citation",
      },
      {
        id: "doc-a->lib-2:citation",
        source: "doc-a",
        target: "lib-2",
        fieldKey: "citation",
        fieldLabel: "Citation",
        kind: "citation",
      },
    ]);
  });
});
