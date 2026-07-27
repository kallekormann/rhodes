import { describe, expect, it } from "vitest";
import { updateDocumentSchema } from "@/lib/documents/schemas";

describe("updateDocumentSchema", () => {
  it("accepts owner offline_available toggle", () => {
    const parsed = updateDocumentSchema.safeParse({ offline_available: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.offline_available).toBe(true);
    }
  });

  it("rejects non-boolean offline_available", () => {
    const parsed = updateDocumentSchema.safeParse({ offline_available: "yes" });
    expect(parsed.success).toBe(false);
  });
});
