import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionStore = new Map<string, string>();

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => sessionStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    sessionStore.set(key, value);
  },
  removeItem: (key: string) => {
    sessionStore.delete(key);
  },
});

import {
  appendClientError,
  clearClientErrors,
  readClientErrors,
} from "@/lib/dev/client-error-log";

describe("client-error-log", () => {
  beforeEach(async () => {
    sessionStore.clear();
    await clearClientErrors();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (init?.method === "POST") {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(JSON.stringify({ rows: [] }), { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("buffers errors in memory and sessionStorage", async () => {
    await appendClientError({
      message: "Test failure",
      source: "test",
      stack: "Error: Test failure\n  at test",
    });

    const rows = await readClientErrors();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.message).toBe("Test failure");
    expect(sessionStore.get("rhodes:client_errors:v1")).toContain("Test failure");
  });

  it("clears memory and calls DELETE on dev API", async () => {
    await appendClientError({ message: "one", source: "test" });
    await clearClientErrors();
    expect(await readClientErrors()).toEqual([]);
    expect(fetch).toHaveBeenCalledWith(
      "/app/api/dev/client-errors",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
