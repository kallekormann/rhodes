import { describe, expect, it } from "vitest";
import {
  documentsEmptyCopy,
  ganttEmptyCopy,
  knowledgeGraphEmptyCopy,
} from "@/lib/views/empty-states";

describe("documentsEmptyCopy", () => {
  it("keeps first-run copy short with quiet CTAs", () => {
    const copy = documentsEmptyCopy({
      canWrite: true,
      offline: false,
      tab: "recent",
      filtered: false,
    });
    expect(copy.title).toBe("No documents yet");
    expect(copy.primaryLabel).toBe("New document");
    expect(copy.secondaryLabel).toBe("Templates");
  });

  it("explains offline empty without alarm language", () => {
    const copy = documentsEmptyCopy({
      canWrite: true,
      offline: true,
      tab: "all",
      filtered: false,
    });
    expect(copy.title.toLowerCase()).toContain("offline");
    expect(copy.primaryLabel).toBeUndefined();
  });
});

describe("ganttEmptyCopy", () => {
  it("names the date field quietly", () => {
    const copy = ganttEmptyCopy({
      canWrite: true,
      hasDateField: true,
      fieldLabel: "Launch date",
    });
    expect(copy.description).toMatch(/Launch date/);
    expect(copy.primaryLabel).toBe("New entry");
  });
});

describe("knowledgeGraphEmptyCopy", () => {
  it("stays short about connections", () => {
    const copy = knowledgeGraphEmptyCopy(true);
    expect(copy.title).toBe("Nothing to show yet");
    expect(copy.description?.length ?? 0).toBeLessThan(120);
  });
});
