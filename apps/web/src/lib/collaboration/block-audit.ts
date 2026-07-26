import type * as Y from "yjs";

/**
 * Durable, per-block "who touched this" trail stored inside the Y.Doc itself.
 *
 * Why this exists: attributing a conflicting block to the right peer cannot be
 * done reliably by diffing content or comparing awareness timestamps, because
 * every already-synced online peer's catch-up reply contains the *entire*
 * merged document, not just their own change — a bystander who never touched
 * a block looks identical to its real author once everyone is back in sync.
 * Recording authorship explicitly, keyed by (blockId, userId), sidesteps that
 * entirely: this Y.Map replicates through the exact same CRDT sync/update
 * messages as the document body, so it reaches a reconnecting client with the
 * same reliability as the text itself.
 *
 * Keying by `${blockId}::${userId}` (never a single per-block key) means two
 * different users writing concurrently never race on the same map key — each
 * write is independent, so plain last-write-wins-per-key CRDT semantics are
 * all that's needed. No read-modify-write, no merge logic.
 */

export type BlockAuditEntry = {
  userId: string;
  displayName: string;
  editedAt: number;
};

/** Yjs transaction origin for audit-trail writes (content-neutral, always safe to broadcast/persist). */
export const BLOCK_AUDIT_ORIGIN = "block-audit";

const BLOCK_AUDIT_MAP_NAME = "blockAudit";

function auditKey(blockId: string, userId: string): string {
  return `${blockId}::${userId}`;
}

function getAuditMap(doc: Y.Doc): Y.Map<BlockAuditEntry> {
  return doc.getMap<BlockAuditEntry>(BLOCK_AUDIT_MAP_NAME);
}

/** Record that `userId` touched (added/edited/removed) each of `blockIds` just now. */
export function recordBlockAudit(
  doc: Y.Doc,
  blockIds: string[],
  userId: string,
  displayName: string,
  editedAt: number = Date.now(),
): void {
  if (blockIds.length === 0 || !userId) return;
  const map = getAuditMap(doc);
  doc.transact(() => {
    for (const blockId of blockIds) {
      if (!blockId) continue;
      map.set(auditKey(blockId, userId), { userId, displayName, editedAt });
    }
  }, BLOCK_AUDIT_ORIGIN);
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug(
      "[block-audit] recorded",
      JSON.stringify({ blockIds, userId, displayName, editedAt }),
    );
  }
}

/**
 * All distinct users recorded as having touched `blockId` at or after `sinceMs`.
 * `excludeUserId` filters out the caller's own identity (e.g. the offline
 * returner reviewing their own conflicts should never see themselves listed).
 */
export function getBlockContributors(
  doc: Y.Doc,
  blockId: string,
  sinceMs: number,
  excludeUserId?: string,
): BlockAuditEntry[] {
  const map = getAuditMap(doc);
  const prefix = `${blockId}::`;
  const out: BlockAuditEntry[] = [];
  map.forEach((value, key) => {
    if (!key.startsWith(prefix) || !value) return;
    if (value.editedAt < sinceMs) return;
    if (excludeUserId && value.userId === excludeUserId) return;
    out.push(value);
  });
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug(
      "[block-audit] read",
      JSON.stringify({
        blockId,
        sinceMs,
        excludeUserId,
        mapSize: map.size,
        mapKeys: [...map.keys()].filter((k) => k.startsWith(prefix)),
        found: out,
      }),
    );
  }
  return out;
}

/** Drop audit entries older than `olderThanMs` so the map never grows unbounded. */
export function pruneBlockAudit(doc: Y.Doc, olderThanMs: number): void {
  const map = getAuditMap(doc);
  const cutoff = Date.now() - olderThanMs;
  const stale: string[] = [];
  map.forEach((value, key) => {
    if (!value || value.editedAt < cutoff) stale.push(key);
  });
  if (stale.length === 0) return;
  doc.transact(() => {
    for (const key of stale) map.delete(key);
  }, BLOCK_AUDIT_ORIGIN);
}
