import { describe, expect, it, vi } from "vitest";
import {
  estimateIdbStorage,
  IDB_QUOTA_WARN_RATIO,
} from "@/lib/offline/idb-quota-monitor";

describe("idb-quota-monitor", () => {
  it("flags high usage when ratio crosses the warn threshold", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn(async () => ({
          usage: 900,
          quota: 1000,
        })),
      },
    });

    const estimate = await estimateIdbStorage();
    expect(estimate.isHigh).toBe(true);
    expect(estimate.ratio).toBe(0.9);

    vi.unstubAllGlobals();
  });

  it("does not flag high usage for large quotas with modest absolute usage", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn(async () => ({
          usage: 51 * 1024 * 1024,
          quota: 5171 * 1024 * 1024,
        })),
      },
    });

    const estimate = await estimateIdbStorage();
    expect(estimate.isHigh).toBe(false);
    expect(estimate.ratio).toBeLessThan(IDB_QUOTA_WARN_RATIO);

    vi.unstubAllGlobals();
  });

  it("returns safe defaults when estimate is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    const estimate = await estimateIdbStorage();
    expect(estimate).toEqual({
      usageBytes: null,
      quotaBytes: null,
      ratio: null,
      isHigh: false,
    });

    vi.unstubAllGlobals();
  });
});
