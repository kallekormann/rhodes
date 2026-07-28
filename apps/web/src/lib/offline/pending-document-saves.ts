/** Tracks in-flight IndexedDB document saves so sync can wait for them. */

const pending = new Set<Promise<unknown>>();

export function trackPendingDocumentSave(promise: Promise<unknown>): void {
  pending.add(promise);
  void promise.finally(() => {
    pending.delete(promise);
  });
}

export async function awaitPendingDocumentSaves(): Promise<void> {
  while (pending.size > 0) {
    await Promise.all([...pending]);
  }
}
