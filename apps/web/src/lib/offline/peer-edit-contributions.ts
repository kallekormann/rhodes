import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import {
  extractBlockTexts,
  type ProseMirrorJsonNode,
} from "@/lib/offline/yjs-offline-divergence";
import { offlineSnapshotToDoc } from "@/lib/offline/yjs-offline-snapshot";
import type { DeferredPeerUpdate } from "@/lib/collaboration/supabase-yjs-provider";

export type PeerEditContributor = {
  clientId: number;
  userId: string;
  displayName: string;
  blockText: string;
  blockIndex: number;
  mineBlock?: ProseMirrorJsonNode;
};

function awarenessUserForClient(
  awareness: Awareness,
  clientId: number,
): { userId: string; displayName: string } {
  const state = awareness.getStates().get(clientId);
  const user = state?.user as { id?: string; name?: string } | undefined;
  return {
    userId: user?.id ?? `peer-${clientId}`,
    displayName: user?.name ?? "Other editor",
  };
}

/** Per-peer block text from deferred Yjs updates (one entry per remote client). */
export function peerEditContributorsForBlock(params: {
  baseSnapshot: { state: string; capturedAt: string };
  deferredUpdates: DeferredPeerUpdate[];
  awareness: Awareness;
  blockId: string;
  blockIndex: number;
}): PeerEditContributor[] {
  const { baseSnapshot, deferredUpdates, awareness, blockId, blockIndex } =
    params;

  const byClient = new Map<number, Uint8Array[]>();
  for (const entry of deferredUpdates) {
    if (entry.clientId == null || entry.clientId < 0) continue;
    const list = byClient.get(entry.clientId) ?? [];
    list.push(entry.update);
    byClient.set(entry.clientId, list);
  }

  const contributors: PeerEditContributor[] = [];

  for (const [clientId, updates] of byClient) {
    const doc = offlineSnapshotToDoc(baseSnapshot);
    for (const update of updates) {
      if (update.length > 0) {
        Y.applyUpdate(doc, update, "offline-peer-contribution");
      }
    }

    const blocks = extractBlockTexts(doc);
    const block = blocks.get(blockId);
    const { userId, displayName } = awarenessUserForClient(awareness, clientId);

    contributors.push({
      clientId,
      userId,
      displayName,
      blockText: block?.text ?? "",
      blockIndex: block?.blockIndex ?? blockIndex,
    });

    doc.destroy();
  }

  return contributors.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function peerContributorSummary(
  contributors: PeerEditContributor[],
): string {
  if (contributors.length === 0) return "Others";
  if (contributors.length === 1) return contributors[0].displayName;
  if (contributors.length === 2) {
    return `${contributors[0].displayName} and ${contributors[1].displayName}`;
  }
  const rest = contributors.length - 1;
  return `${contributors[0].displayName} and ${rest} others`;
}
