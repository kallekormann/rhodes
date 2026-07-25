import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import {
  extractBlockTexts,
  extractOrderedBlocks,
  type ProseMirrorJsonNode,
} from "@/lib/offline/yjs-offline-divergence";
import { offlineSnapshotToDoc } from "@/lib/offline/yjs-offline-snapshot";
import type {
  DeferredPeerUpdate,
  PeerIdentity,
} from "@/lib/collaboration/supabase-yjs-provider";

export type PeerEditContributor = {
  clientId: number;
  userId: string;
  displayName: string;
  blockText: string;
  blockIndex: number;
  mineBlock?: ProseMirrorJsonNode;
};

/**
 * Keep peers who edited this block relative to the offline base.
 * Missing block alone is not a delete — require a top-level block-count drop
 * (same honesty rule as peerTouchedBlock).
 */
export function peerTouchedBlockVsBase(params: {
  baseExisted: boolean;
  baseText: string;
  peerBlockExists: boolean;
  peerText: string;
  baseBlockCount?: number;
  peerBlockCount?: number;
}): boolean {
  const {
    baseExisted,
    baseText,
    peerBlockExists,
    peerText,
    baseBlockCount,
    peerBlockCount,
  } = params;

  if (baseExisted && peerBlockExists && peerText !== baseText) return true;
  if (!baseExisted && peerBlockExists) return true;
  if (baseExisted && !peerBlockExists) {
    if (
      typeof baseBlockCount === "number" &&
      typeof peerBlockCount === "number"
    ) {
      return peerBlockCount < baseBlockCount;
    }
    // Without counts, do not invent deletes from noisy extracts.
    return false;
  }
  return false;
}

function awarenessUserForClient(
  awareness: Awareness,
  clientId: number,
): PeerIdentity {
  const state = awareness.getStates().get(clientId);
  const user = state?.user as { id?: string; name?: string } | undefined;
  const lastLocalEditAt = state?.lastLocalEditAt as number | undefined;
  return {
    userId: user?.id ?? `peer-${clientId}`,
    displayName: user?.name?.trim() || "Other editor",
    lastLocalEditAt,
  };
}

function resolveIdentity(
  clientId: number,
  entryIdentity: PeerIdentity | undefined,
  awareness: Awareness,
  getPeerIdentity?: (clientId: number) => PeerIdentity,
): PeerIdentity {
  if (entryIdentity?.displayName && entryIdentity.displayName !== "Other editor") {
    return entryIdentity;
  }
  if (getPeerIdentity) {
    const fromProvider = getPeerIdentity(clientId);
    if (fromProvider.displayName !== "Other editor") return fromProvider;
  }
  const fromAwareness = awarenessUserForClient(awareness, clientId);
  if (fromAwareness.displayName !== "Other editor") return fromAwareness;
  return entryIdentity ?? fromAwareness;
}

function mergedPeerBlockText(
  baseSnapshot: { state: string; capturedAt: string },
  deferredUpdates: DeferredPeerUpdate[],
  blockId: string,
): { text: string; exists: boolean; blockCount: number; baseBlockCount: number } {
  const baseDoc = offlineSnapshotToDoc(baseSnapshot);
  const baseBlockCount = extractOrderedBlocks(baseDoc).length;
  baseDoc.destroy();

  const doc = offlineSnapshotToDoc(baseSnapshot);
  for (const entry of deferredUpdates) {
    if (entry.update.length > 0) {
      Y.applyUpdate(doc, entry.update, "offline-peer-contribution");
    }
  }
  const blocks = extractBlockTexts(doc);
  const block = blocks.get(blockId);
  const blockCount = extractOrderedBlocks(doc).length;
  doc.destroy();
  return {
    text: block?.text ?? "",
    exists: Boolean(block),
    blockCount,
    baseBlockCount,
  };
}

/** Unknown authorship — do not list idle awareness peers as conflicting parties. */
function syntheticOthersContributor(params: {
  blockText: string;
  blockIndex: number;
}): PeerEditContributor[] {
  return [
    {
      clientId: -1,
      userId: "peer-merged",
      displayName: "Others",
      blockText: params.blockText,
      blockIndex: params.blockIndex,
    },
  ];
}

type RawContributorCandidate = PeerEditContributor & {
  lastLocalEditAt?: number;
  signature: string;
};

function contentSignature(exists: boolean, text: string): string {
  return exists ? `1:${text}` : "0";
}

function windowStartMsFromSnapshot(baseSnapshot: { capturedAt: string }): number {
  const parsed = Date.parse(baseSnapshot.capturedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Every online peer independently answers a reconnecting client's sync
 * handshake, so the same real change can arrive relayed through several
 * distinct clientIds (e.g. an idle bystander who is merely in sync with the
 * real author). Candidates that resolve to the exact same resulting block
 * content are almost certainly echoes of one real edit, not independent
 * edits — keep only the one(s) whose own lastLocalEditAt falls inside the
 * offline conflict window; collapse to "Others" if that can't be decided.
 */
function disambiguateContributors(
  candidates: RawContributorCandidate[],
  windowStartMs: number,
): PeerEditContributor[] {
  const groups = new Map<string, RawContributorCandidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.signature) ?? [];
    group.push(candidate);
    groups.set(candidate.signature, group);
  }

  const resolved: PeerEditContributor[] = [];
  for (const group of groups.values()) {
    const distinctUserIds = new Set(group.map((entry) => entry.userId));
    if (distinctUserIds.size <= 1) {
      resolved.push(...group);
      continue;
    }

    const withinWindow = uniquePeerContributors(
      group.filter(
        (entry) =>
          typeof entry.lastLocalEditAt === "number" &&
          entry.lastLocalEditAt >= windowStartMs,
      ),
    );

    if (withinWindow.length === 1) {
      resolved.push(withinWindow[0]);
    } else {
      resolved.push(
        ...syntheticOthersContributor({
          blockText: group[0].blockText,
          blockIndex: group[0].blockIndex,
        }),
      );
    }
  }
  return resolved;
}

/**
 * Per-peer block text from deferred Yjs update/sync messages. Every online
 * peer replies to a reconnecting client's sync handshake — sync step2 is
 * often the *only* way a genuine edit reaches the returner, so it can't be
 * blanket-excluded. disambiguateContributors() resolves the resulting
 * duplicates instead of a blunt source-based filter.
 */
export function peerEditContributorsForBlock(params: {
  baseSnapshot: { state: string; capturedAt: string };
  deferredUpdates: DeferredPeerUpdate[];
  awareness: Awareness;
  blockId: string;
  blockIndex: number;
  localClientId?: number;
  localUserId?: string;
  getPeerIdentity?: (clientId: number) => PeerIdentity;
}): PeerEditContributor[] {
  const {
    baseSnapshot,
    deferredUpdates,
    awareness,
    blockId,
    blockIndex,
    localClientId,
    localUserId,
    getPeerIdentity,
  } = params;

  const baseDoc = offlineSnapshotToDoc(baseSnapshot);
  const baseBlocks = extractBlockTexts(baseDoc);
  const baseBlockCount = extractOrderedBlocks(baseDoc).length;
  const baseBlock = baseBlocks.get(blockId);
  const baseExisted = Boolean(baseBlock);
  const baseText = baseBlock?.text ?? "";
  baseDoc.destroy();

  const byClient = new Map<
    number,
    { updates: Uint8Array[]; identity?: PeerIdentity }
  >();
  const orphanUpdates: Uint8Array[] = [];

  for (const entry of deferredUpdates) {
    if (entry.clientId == null || entry.clientId < 0) {
      orphanUpdates.push(entry.update);
      continue;
    }
    if (localClientId != null && entry.clientId === localClientId) {
      continue;
    }
    const bucket = byClient.get(entry.clientId) ?? {
      updates: [],
      identity: entry.identity,
    };
    bucket.updates.push(entry.update);
    if (
      entry.identity?.displayName &&
      entry.identity.displayName !== "Other editor"
    ) {
      bucket.identity = entry.identity;
    }
    byClient.set(entry.clientId, bucket);
  }

  const candidates: RawContributorCandidate[] = [];

  for (const [clientId, bucket] of byClient) {
    const doc = offlineSnapshotToDoc(baseSnapshot);
    for (const update of bucket.updates) {
      if (update.length > 0) {
        Y.applyUpdate(doc, update, "offline-peer-contribution");
      }
    }

    const blocks = extractBlockTexts(doc);
    const block = blocks.get(blockId);
    const peerText = block?.text ?? "";
    const peerBlockExists = Boolean(block);
    const peerBlockCount = extractOrderedBlocks(doc).length;

    if (
      !peerTouchedBlockVsBase({
        baseExisted,
        baseText,
        peerBlockExists,
        peerText,
        baseBlockCount,
        peerBlockCount,
      })
    ) {
      doc.destroy();
      continue;
    }

    const identity = resolveIdentity(
      clientId,
      bucket.identity,
      awareness,
      getPeerIdentity,
    );

    if (localUserId && identity.userId === localUserId) {
      doc.destroy();
      continue;
    }

    candidates.push({
      clientId,
      userId: identity.userId,
      displayName: identity.displayName,
      blockText: peerText,
      blockIndex: block?.blockIndex ?? blockIndex,
      lastLocalEditAt: identity.lastLocalEditAt,
      signature: contentSignature(peerBlockExists, peerText),
    });

    doc.destroy();
  }

  const contributors = disambiguateContributors(
    candidates,
    windowStartMsFromSnapshot(baseSnapshot),
  );

  if (contributors.length > 0) {
    return uniquePeerContributors(contributors).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }

  if (orphanUpdates.length > 0) {
    const doc = offlineSnapshotToDoc(baseSnapshot);
    for (const update of orphanUpdates) {
      if (update.length > 0) {
        Y.applyUpdate(doc, update, "offline-peer-contribution");
      }
    }
    const blocks = extractBlockTexts(doc);
    const block = blocks.get(blockId);
    const peerText = block?.text ?? "";
    const peerBlockExists = Boolean(block);
    const peerBlockCount = extractOrderedBlocks(doc).length;
    doc.destroy();

    if (
      peerTouchedBlockVsBase({
        baseExisted,
        baseText,
        peerBlockExists,
        peerText,
        baseBlockCount,
        peerBlockCount,
      })
    ) {
      return syntheticOthersContributor({
        blockText: peerText,
        blockIndex,
      });
    }
    return [];
  }

  // No attributable y-updates — if the merged peer doc still touched the block
  // (via sync-only catch-up), show a single synthetic party, never idle awareness.
  if (deferredUpdates.length === 0) {
    return [];
  }

  const merged = mergedPeerBlockText(baseSnapshot, deferredUpdates, blockId);
  if (
    !peerTouchedBlockVsBase({
      baseExisted,
      baseText,
      peerBlockExists: merged.exists,
      peerText: merged.text,
      baseBlockCount: merged.baseBlockCount,
      peerBlockCount: merged.blockCount,
    })
  ) {
    return [];
  }

  return syntheticOthersContributor({
    blockText: merged.text,
    blockIndex,
  });
}

export function uniquePeerContributors(
  contributors: PeerEditContributor[],
): PeerEditContributor[] {
  const byUser = new Map<string, PeerEditContributor>();
  for (const contributor of contributors) {
    const existing = byUser.get(contributor.userId);
    if (!existing) {
      byUser.set(contributor.userId, contributor);
      continue;
    }
    if (
      existing.displayName === "Other editor" &&
      contributor.displayName !== "Other editor"
    ) {
      byUser.set(contributor.userId, contributor);
    }
  }
  return [...byUser.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

export function peerContributorSummary(
  contributors: PeerEditContributor[],
): string {
  const unique = uniquePeerContributors(contributors);
  if (unique.length === 0) return "Others";
  if (unique.length === 1) return unique[0].displayName;
  if (unique.length === 2) {
    return `${unique[0].displayName} and ${unique[1].displayName}`;
  }
  const rest = unique.length - 1;
  return `${unique[0].displayName} and ${rest} others`;
}
