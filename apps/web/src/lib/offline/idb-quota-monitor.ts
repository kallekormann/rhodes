/**
 * M1c.5 — Browser storage quota monitor (origin-wide via navigator.storage.estimate).
 */

/** Show banner / warn styling when this share of the browser quota is used. */
export const IDB_QUOTA_WARN_RATIO = 0.85;

export type IdbStorageEstimate = {
  usageBytes: number | null;
  quotaBytes: number | null;
  ratio: number | null;
  /** True when the browser quota is nearly exhausted (ratio ≥ IDB_QUOTA_WARN_RATIO). */
  isHigh: boolean;
};

export async function estimateIdbStorage(): Promise<IdbStorageEstimate> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { usageBytes: null, quotaBytes: null, ratio: null, isHigh: false };
  }

  try {
    const { usage, quota } = await navigator.storage.estimate();
    const usageBytes = typeof usage === "number" ? usage : null;
    const quotaBytes = typeof quota === "number" ? quota : null;
    const ratio =
      usageBytes != null && quotaBytes != null && quotaBytes > 0
        ? usageBytes / quotaBytes
        : null;
    const isHigh = ratio != null ? ratio >= IDB_QUOTA_WARN_RATIO : false;

    return { usageBytes, quotaBytes, ratio, isHigh };
  } catch {
    return { usageBytes: null, quotaBytes: null, ratio: null, isHigh: false };
  }
}
