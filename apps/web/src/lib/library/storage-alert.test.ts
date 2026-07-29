import { describe, expect, it } from "vitest";
import { classifyLibraryFailure } from "@rhodes/shared/library-failure";
import {
  isStorageApiError,
  STORAGE_ALERT_LOG_PREFIX,
} from "@rhodes/shared/storage-alert";

describe("storage-alert", () => {
  it("detects storage API failures", () => {
    expect(isStorageApiError(new Error("Storage API error: bucket not found"))).toBe(
      true,
    );
    expect(isStorageApiError(new Error("Could not download library file"))).toBe(
      true,
    );
    expect(isStorageApiError(new Error("Tika extraction failed"))).toBe(false);
  });

  it("uses a stable alert log prefix", () => {
    expect(STORAGE_ALERT_LOG_PREFIX).toBe("[rhodes:storage-alert]");
  });
});

describe("library-failure storage classification", () => {
  it("classifies storage backend errors as file_missing", () => {
    expect(
      classifyLibraryFailure(new Error("Storage API error: object not found")).code,
    ).toBe("file_missing");
  });
});
