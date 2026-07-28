import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { recordBlockAudit } from "@/lib/collaboration/block-audit";
import { uint8ToBase64 } from "@/lib/collaboration/supabase-yjs-provider";
import type { DeferredPeerUpdate } from "@/lib/collaboration/supabase-yjs-provider";
import {
  buildBlockReviewModels,
  clusterReviewSummary,
  reviewForBlock,
} from "@/lib/offline/base-aligned-review";
import { peerEditContributorsForBlock } from "@/lib/offline/peer-edit-contributions";
import { clustersFromBlockConflicts } from "@/lib/offline/span-conflict-clusters";
import { detectOfflineBlockConflicts } from "@/lib/offline/yjs-offline-divergence";

function seedParagraph(doc: Y.Doc, blockId: string, text: string): void {
  const fragment = doc.getXmlFragment("default");
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.setAttribute("blockId", blockId);
  const xmlText = new Y.XmlText();
  xmlText.insert(0, text);
  paragraph.insert(0, [xmlText]);
  fragment.insert(fragment.length, [paragraph]);
}

function setBlockText(doc: Y.Doc, index: number, text: string): void {
  const paragraph = doc.getXmlFragment("default").get(index) as Y.XmlElement;
  const xmlText = paragraph.get(0) as Y.XmlText;
  xmlText.delete(0, xmlText.length);
  xmlText.insert(0, text);
}

function deleteBlock(doc: Y.Doc, index: number): void {
  doc.getXmlFragment("default").delete(index, 1);
}

function deferredUpdateFromDoc(
  doc: Y.Doc,
  vectorDoc: Y.Doc,
  clientId: number,
): DeferredPeerUpdate {
  return {
    clientId,
    update: Y.encodeStateAsUpdate(doc, Y.encodeStateVector(vectorDoc)),
  };
}

describe("multi-conflict review (TD-001)", () => {
  it("block delete + inline word overlap surfaces correct summaries per cluster", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Block one original");
    seedParagraph(base, "b2", "shared word here");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    setBlockText(mine, 0, "Block one offline");
    setBlockText(mine, 1, "shared OFFLINE here");

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    deleteBlock(peerB, 0);
    recordBlockAudit(peerB, ["b1"], "user-b", "User B");

    const peerC = new Y.Doc();
    Y.applyUpdate(peerC, baseBytes);
    setBlockText(peerC, 1, "shared ONLINE here");
    recordBlockAudit(peerC, ["b2"], "user-c", "User C");

    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, baseBytes);
    Y.applyUpdate(
      peerDoc,
      Y.encodeStateAsUpdate(peerB, Y.encodeStateVector(vectorDoc)),
    );
    Y.applyUpdate(
      peerDoc,
      Y.encodeStateAsUpdate(peerC, Y.encodeStateVector(vectorDoc)),
    );

    const conflicts = detectOfflineBlockConflicts(
      base,
      mine,
      peerDoc,
      undefined,
      { catchupComplete: true },
    );
    expect(conflicts).toHaveLength(2);

    const deferredUpdates = [
      deferredUpdateFromDoc(peerB, vectorDoc, 1),
      deferredUpdateFromDoc(peerC, vectorDoc, 2),
    ];
    const peerContributorsByBlock = new Map(
      conflicts.map((conflict) => [
        conflict.blockId,
        peerEditContributorsForBlock({
          baseSnapshot,
          deferredUpdates,
          blockId: conflict.blockId,
          blockIndex: conflict.blockIndex,
        }),
      ]),
    );
    const authorByBlock = new Map(
      [...peerContributorsByBlock.entries()].map(([blockId, contributors]) => [
        blockId,
        contributors[0]?.displayName ?? "Others",
      ]),
    );

    const clusters = clustersFromBlockConflicts(conflicts, authorByBlock);
    const reviews = buildBlockReviewModels(
      conflicts,
      clusters,
      peerContributorsByBlock,
    );

    const block1Cluster = clusters.find((c) => c.blockId === "b1");
    const block2Cluster = clusters.find((c) => c.blockId === "b2");
    expect(block1Cluster).toBeDefined();
    expect(block2Cluster).toBeDefined();

    const block1Review = reviewForBlock(reviews, "b1");
    const block2Review = reviewForBlock(reviews, "b2");
    expect(block1Review?.kind).toBe("mine_edited_peer_deleted");
    expect(block2Review?.kind).toBe("both_edited");

    const block1Summary = clusterReviewSummary(
      block1Review!,
      block1Cluster!.id,
      block1Review!.kind,
    );
    const block2Summary = clusterReviewSummary(
      block2Review!,
      block2Cluster!.id,
      block2Review!.kind,
    );

    expect(block1Summary).toContain("User B");
    expect(block1Summary).toContain("deleted");
    expect(block2Summary).not.toContain("deleted");
    expect(block2Summary).toContain("User C");

    base.destroy();
    mine.destroy();
    peerB.destroy();
    peerC.destroy();
    peerDoc.destroy();
    vectorDoc.destroy();
  });
});
