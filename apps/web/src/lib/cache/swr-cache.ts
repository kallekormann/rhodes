/** Client-side stale-while-revalidate helpers for workspace-scoped fetches. */

export const DEFAULT_SWR_TTL_MS = 45_000;

export function isCacheFresh(
  fetchedAt: number | undefined,
  ttlMs: number = DEFAULT_SWR_TTL_MS,
): boolean {
  if (fetchedAt == null) return false;
  return Date.now() - fetchedAt < ttlMs;
}

type TimedCacheEntry<T> = {
  value: T;
  fetchedAt: number;
};

export function createTimedCache<T>() {
  const store = new Map<string, TimedCacheEntry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  return {
    get(key: string): TimedCacheEntry<T> | undefined {
      return store.get(key);
    },
    set(key: string, value: T): void {
      store.set(key, { value, fetchedAt: Date.now() });
    },
    delete(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    async getOrFetch(
      key: string,
      fetcher: () => Promise<T>,
      options?: { force?: boolean; ttlMs?: number },
    ): Promise<{ value: T; fromCache: boolean }> {
      const ttlMs = options?.ttlMs ?? DEFAULT_SWR_TTL_MS;
      if (!options?.force) {
        const hit = store.get(key);
        if (hit && isCacheFresh(hit.fetchedAt, ttlMs)) {
          return { value: hit.value, fromCache: true };
        }
        const pending = inFlight.get(key);
        if (pending) {
          return { value: await pending, fromCache: false };
        }
      }

      const job = (async () => {
        const value = await fetcher();
        store.set(key, { value, fetchedAt: Date.now() });
        return value;
      })();

      inFlight.set(key, job);
      try {
        return { value: await job, fromCache: false };
      } finally {
        inFlight.delete(key);
      }
    },
  };
}
