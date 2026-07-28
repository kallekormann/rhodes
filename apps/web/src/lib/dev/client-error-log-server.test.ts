import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let logPath = "";

vi.mock("@/lib/dev/client-error-log-path", () => ({
  getClientErrorLogPath: () => logPath,
}));

import {
  appendClientErrorToFile,
  clearClientErrorFile,
  readClientErrorsFromFile,
} from "@/lib/dev/client-error-log-server";

describe("client-error-log-server", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "rhodes-client-error-"));
    logPath = path.join(tmpDir, "client-errors.log");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("appends NDJSON lines to the log file", async () => {
    await appendClientErrorToFile({
      id: "1",
      at: "2026-07-27T00:00:00.000Z",
      message: "Test failure",
      source: "test",
      online: false,
    });

    const raw = await readFile(logPath, "utf8");
    expect(raw.trim()).toContain('"message":"Test failure"');

    const rows = await readClientErrorsFromFile();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.message).toBe("Test failure");
  });

  it("clears the log file", async () => {
    await appendClientErrorToFile({
      id: "1",
      at: "2026-07-27T00:00:00.000Z",
      message: "one",
      online: true,
    });
    await clearClientErrorFile();
    expect(await readClientErrorsFromFile()).toEqual([]);
  });
});
