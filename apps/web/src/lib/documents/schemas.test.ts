import { describe, expect, it } from "vitest";
import { updateDocumentSchema } from "@/lib/documents/schemas";

describe("updateDocumentSchema", () => {
  it("accepts title patches", () => {
    const parsed = updateDocumentSchema.safeParse({ title: "Renamed" });
    expect(parsed.success).toBe(true);
  });
});
