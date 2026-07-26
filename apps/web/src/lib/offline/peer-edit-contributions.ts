import * as Y from "yjs";
import {
  extractBlockTexts,
  extractOrderedBlocks,
  type ProseMirrorJsonNode,
} from "@/lib/offline/yjs-offline-divergence";
import { offlineSnapshotToDoc } from "@/lib/offline/yjs-offline-snapshot";
import { getBlockContributors } from "@/lib/collaboration/block-audit";
import type { DeferredPeerUpdate } from "@/lib/collaboration/supabase-yjs-provider";

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

function windowStartMsFromSnapshot(baseSnapshot: { capturedAt: string }): number {
  const parsed = Date.parse(baseSnapshot.capturedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Peer document for attribution: offline base ⊕ every queued deferred update. Caller owns destroy(). */
function buildMergedPeerDoc(
  baseSnapshot: { state: string; capturedAt: string },
  deferredUpdates: DeferredPeerUpdate[],
): Y.Doc {
  const doc = offlineSnapshotToDoc(baseSnapshot);
  for (const entry of deferredUpdates) {
    if (entry.update.length > 0) {
      Y.applyUpdate(doc, entry.update, "offline-peer-contribution");
    }
  }
  return doc;
}

/**
 * Who touched this block while the offline returner was away.
 *
 * Authorship is read directly from the collaborative block-audit trail (a
 * Y.Map replicated inside the document itself — see
 * `@/lib/collaboration/block-audit`), not inferred from content diffing or
 * awareness timestamps. Every online peer's catch-up reply necessarily
 * contains the *entire* merged document, so a bystander who never touched a
 * block is otherwise indistinguishable from its real author once everyone is
 * back in sync — the audit trail sidesteps that by having each editor record
 * their own change explicitly, at edit time, on their own machine.
 */
export function peerEditContributorsForBlock(params: {
  baseSnapshot: { state: string; capturedAt: string };
  deferredUpdates: DeferredPeerUpdate[];
  blockId: string;
  blockIndex: number;
  localUserId?: string;
}): PeerEditContributor[] {
  const { baseSnapshot, deferredUpdates, blockId, blockIndex, localUserId } =
    params;

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug(
      "[peer-edit-contributions] start",
      JSON.stringify({
        blockId,
        blockIndex,
        localUserId,
        deferredUpdateCount: deferredUpdates.length,
        deferredSources: deferredUpdates.map((u) => u.source ?? "update"),
      }),
    );
  }

  if (deferredUpdates.length === 0) return [];

  const baseDoc = offlineSnapshotToDoc(baseSnapshot);
  const baseBlocks = extractBlockTexts(baseDoc);
  const baseBlockCount = extractOrderedBlocks(baseDoc).length;
  const baseBlock = baseBlocks.get(blockId);
  const baseExisted = Boolean(baseBlock);
  const baseText = baseBlock?.text ?? "";
  baseDoc.destroy();

  const mergedDoc = buildMergedPeerDoc(baseSnapshot, deferredUpdates);
  const mergedBlocks = extractBlockTexts(mergedDoc);
  const mergedBlock = mergedBlocks.get(blockId);
  const peerText = mergedBlock?.text ?? "";
  const peerBlockExists = Boolean(mergedBlock);
  const peerBlockCount = extractOrderedBlocks(mergedDoc).length;

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
    mergedDoc.destroy();
    return [];
  }

  const windowStartMs = windowStartMsFromSnapshot(baseSnapshot);
  const auditEntries = getBlockContributors(
    mergedDoc,
    blockId,
    windowStartMs,
    localUserId,
  );
  mergedDoc.destroy();

  if (auditEntries.length > 0) {
    const contributors: PeerEditContributor[] = auditEntries.map((entry) => ({
      clientId: -1,
      userId: entry.userId,
      displayName: entry.displayName,
      blockText: peerText,
      blockIndex,
    }));
    return uniquePeerContributors(contributors);
  }

  // No audit entry (e.g. a document that hasn't been touched since this
  // feature shipped) — fall back to the pre-existing, no-worse-than-before
  // "Others" placeholder rather than guessing.
  return syntheticOthersContributor({ blockText: peerText, blockIndex });
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
