import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clearOfflineSessionMarker,
  hasOfflineSessionMarker,
  markOfflineSessionPending,
} from "./yjs-offline-snapshot";

describe("offline session marker", () => {
  const docId = "test-doc-id";
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    clearOfflineSessionMarker(docId);
  });

  it("marks and detects the current page load", () => {
    expect(hasOfflineSessionMarker(docId)).toBe(false);
    markOfflineSessionPending(docId);
    expect(hasOfflineSessionMarker(docId)).toBe(true);
  });

  it("clears marker explicitly", () => {
    markOfflineSessionPending(docId);
    clearOfflineSessionMarker(docId);
    expect(hasOfflineSessionMarker(docId)).toBe(false);
  });
});
