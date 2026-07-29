import { describe, expect, it } from "vitest";
import {
  documentMetadataEtag,
  ifNoneMatchSatisfied,
} from "@/lib/documents/document-etag";

describe("document-etag", () => {
  it("quotes updated_at as a strong ETag", () => {
    expect(documentMetadataEtag("2026-07-29T08:00:00.000Z")).toBe(
      '"2026-07-29T08:00:00.000Z"',
    );
  });

  it("matches exact If-None-Match tokens", () => {
    const etag = documentMetadataEtag("2026-07-29T08:00:00.000Z");
    expect(ifNoneMatchSatisfied(etag, etag)).toBe(true);
    expect(ifNoneMatchSatisfied(`W/${etag}`, etag)).toBe(false);
    expect(ifNoneMatchSatisfied(null, etag)).toBe(false);
  });

  it("matches one token in a comma-separated If-None-Match list", () => {
    const etag = documentMetadataEtag("2026-07-29T08:00:00.000Z");
    const other = documentMetadataEtag("2026-07-28T08:00:00.000Z");
    expect(ifNoneMatchSatisfied(`${other}, ${etag}`, etag)).toBe(true);
  });
});
