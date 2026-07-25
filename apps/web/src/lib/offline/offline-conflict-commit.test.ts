import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  buildResolvedBlockPlan,
  buildResolvedBlocks,
  decisionKey,
  orderedBlockIdsForCommit,
} from "@/lib/offline/offline-conflict-commit";
import type { ProseMirrorJsonNode } from "@/lib/offline/yjs-offline-divergence";
import {
  clearedConflictReviewSession,
  isConflictReviewSessionCleared,
} from "@/lib/offline/offline-conflict-session";
import { patchYDocBodyToResolvedBlocks } from "@/lib/offline/yjs-offline-restore";

function paragraph(blockId: string, text: string): ProseMirrorJsonNode {
  return {
    type: "paragraph",
    attrs: { blockId },
    content: [{ type: "text", text }],
  };
}

function docFromNodes(nodes: ProseMirrorJsonNode[]): Y.Doc {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("default");
  for (const node of nodes) {
    const paragraphEl = new Y.XmlElement("paragraph");
    paragraphEl.setAttribute("blockId", node.attrs?.blockId ?? "");
    const text = new Y.XmlText();
    const plain = node.content?.[0]?.text ?? "";
    if (plain) text.insert(0, plain);
    paragraphEl.insert(0, [text]);
    fragment.insert(fragment.length, [paragraphEl]);
  }
  return doc;
}

function plainFromResolved(nodes: ProseMirrorJsonNode[]): string[] {
  return nodes.map((node) => {
    const text = node.content?.[0]?.text ?? "";
    return text;
  });
}

describe("offline-conflict-session teardown", () => {
  it("clearedConflictReviewSession zeros all UI fields", () => {
    const cleared = clearedConflictReviewSession();
    expect(isConflictReviewSessionCleared(cleared)).toBe(true);
    expect(cleared.reviewPending).toBe(false);
    expect(cleared.reviewCount).toBe(0);
  });
});

describe("offline-conflict-commit", () => {
  it("orders peer spine with mine-only blocks spliced by base order", () => {
    const base = [
      { blockId: "a", blockIndex: 0, text: "A", node: paragraph("a", "A") },
      { blockId: "b", blockIndex: 1, text: "B", node: paragraph("b", "B") },
      { blockId: "c", blockIndex: 2, text: "C", node: paragraph("c", "C") },
    ];
    const mine = [
      ...base,
      {
        blockId: "m",
        blockIndex: 3,
        text: "Mine only",
        node: paragraph("m", "Mine only"),
      },
    ];
    const peer = [
      base[0],
      {
        blockId: "p",
        blockIndex: 1,
        text: "Peer insert",
        node: paragraph("p", "Peer insert"),
      },
      base[2],
    ];

    expect(orderedBlockIdsForCommit(base, mine, peer)).toEqual([
      "a",
      "b",
      "p",
      "c",
      "m",
    ]);
  });

  it("keeps mine when peer deleted an offline-edited block", () => {
    const baseDoc = docFromNodes([paragraph("b1", "Original")]);
    const mineDoc = docFromNodes([paragraph("b1", "Offline edit")]);
    const peerDoc = docFromNodes([]);

    const resolved = buildResolvedBlocks({
      baseDoc,
      mineDoc,
      peerDoc,
      decisions: new Map([[decisionKey("b1", 0), { side: "mine" }]]),
    });

    expect(plainFromResolved(resolved)).toEqual(["Offline edit"]);

    baseDoc.destroy();
    mineDoc.destroy();
    peerDoc.destroy();
  });

  it("drops block when user dismisses peer delete", () => {
    const baseDoc = docFromNodes([paragraph("b1", "Original")]);
    const mineDoc = docFromNodes([paragraph("b1", "Offline edit")]);
    const peerDoc = docFromNodes([]);

    const resolved = buildResolvedBlocks({
      baseDoc,
      mineDoc,
      peerDoc,
      decisions: new Map([[decisionKey("b1", 0), { side: "theirs" }]]),
    });

    expect(resolved).toHaveLength(0);

    baseDoc.destroy();
    mineDoc.destroy();
    peerDoc.destroy();
  });

  it("auto-accepts peer-added blocks without a decision", () => {
    const baseDoc = docFromNodes([paragraph("b1", "One")]);
    const mineDoc = docFromNodes([paragraph("b1", "One")]);
    const peerDoc = docFromNodes([
      paragraph("b1", "One"),
      paragraph("b2", "Peer added"),
    ]);

    const resolved = buildResolvedBlocks({
      baseDoc,
      mineDoc,
      peerDoc,
      decisions: new Map(),
    });

    expect(plainFromResolved(resolved)).toEqual(["One", "Peer added"]);

    baseDoc.destroy();
    mineDoc.destroy();
    peerDoc.destroy();
  });

  it("three-doc harness: absorb+commit body is identical for peers", () => {
    const baseDoc = docFromNodes([paragraph("b1", "Hello world")]);
    const mineDoc = docFromNodes([paragraph("b1", "Hello offline")]);
    const peerDoc = docFromNodes([paragraph("b1", "Hello online")]);

    const decisions = new Map([[decisionKey("b1", 0), { side: "mine" as const }]]);
    const resolvedA = buildResolvedBlocks({
      baseDoc,
      mineDoc,
      peerDoc,
      decisions,
    });
    const resolvedB = buildResolvedBlocks({
      baseDoc,
      mineDoc,
      peerDoc,
      decisions,
    });

    expect(plainFromResolved(resolvedA)).toEqual(plainFromResolved(resolvedB));
    expect(plainFromResolved(resolvedA)).toEqual(["Hello offline"]);
    expect(plainFromResolved(resolvedA).join("")).not.toContain(
      "Hello offlineHello",
    );

    baseDoc.destroy();
    mineDoc.destroy();
    peerDoc.destroy();
  });

  it("buildResolvedBlockPlan marks only the changed block as 'peer'", () => {
    const baseDoc = docFromNodes([
      paragraph("a", "A"),
      paragraph("b", "B"),
      paragraph("c", "C"),
    ]);
    const mineDoc = docFromNodes([
      paragraph("a", "A"),
      paragraph("b", "B"),
      paragraph("c", "C"),
    ]);
    const peerDoc = docFromNodes([
      paragraph("a", "A"),
      paragraph("b", "Peer edited B"),
      paragraph("c", "C"),
    ]);

    const plan = buildResolvedBlockPlan({
      baseDoc,
      mineDoc,
      peerDoc,
      decisions: new Map([[decisionKey("b", 1), { side: "theirs" as const }]]),
    });

    expect(plan.map((entry) => entry.blockId)).toEqual(["a", "b", "c"]);
    expect(plan.map((entry) => entry.side)).toEqual(["mine", "peer", "mine"]);

    baseDoc.destroy();
    mineDoc.destroy();
    peerDoc.destroy();
  });

  it("end-to-end: conflict on block 1 (index 0), 'Keep' produces no stray empty blocks", () => {
    // Reproduces the reported symptom via the exact pipeline the hook uses:
    // buildResolvedBlockPlan -> patchYDocBodyToResolvedBlocks against a live
    // doc pinned to "mine" (as it is throughout offline review).
    const baseDoc = docFromNodes([
      paragraph("a", "Base A"),
      paragraph("b", "B"),
      paragraph("c", "C"),
    ]);
    const mineDoc = docFromNodes([
      paragraph("a", "Mine A"),
      paragraph("b", "B"),
      paragraph("c", "C"),
    ]);
    const peerDoc = docFromNodes([
      paragraph("a", "Peer A"),
      paragraph("b", "B"),
      paragraph("c", "C"),
    ]);
    // live mirrors mine exactly, as it does throughout offline review.
    const live = docFromNodes([
      paragraph("a", "Mine A"),
      paragraph("b", "B"),
      paragraph("c", "C"),
    ]);

    // User clicks "Keep" (mine) on the block-1 conflict.
    const plan = buildResolvedBlockPlan({
      baseDoc,
      mineDoc,
      peerDoc,
      decisions: new Map([[decisionKey("a", 0), { side: "mine" as const }]]),
    });

    patchYDocBodyToResolvedBlocks(live, plan);

    const fragment = live.getXmlFragment("default");
    const ids: string[] = [];
    for (let i = 0; i < fragment.length; i += 1) {
      const item = fragment.get(i);
      expect(item instanceof Y.XmlElement).toBe(true);
      if (item instanceof Y.XmlElement) ids.push(item.getAttribute("blockId") ?? "");
    }
    expect(ids).toEqual(["a", "b", "c"]);
    expect(fragment.length).toBe(3);

    baseDoc.destroy();
    mineDoc.destroy();
    peerDoc.destroy();
    live.destroy();
  });

  it("end-to-end: conflict on block 1 (index 0), 'Take theirs' produces no stray empty blocks", () => {
    const baseDoc = docFromNodes([
      paragraph("a", "Base A"),
      paragraph("b", "B"),
      paragraph("c", "C"),
    ]);
    const mineDoc = docFromNodes([
      paragraph("a", "Mine A"),
      paragraph("b", "B"),
      paragraph("c", "C"),
    ]);
    const peerDoc = docFromNodes([
      paragraph("a", "Peer A"),
      paragraph("b", "B"),
      paragraph("c", "C"),
    ]);
    const live = docFromNodes([
      paragraph("a", "Mine A"),
      paragraph("b", "B"),
      paragraph("c", "C"),
    ]);

    const plan = buildResolvedBlockPlan({
      baseDoc,
      mineDoc,
      peerDoc,
      decisions: new Map([[decisionKey("a", 0), { side: "theirs" as const }]]),
    });

    patchYDocBodyToResolvedBlocks(live, plan);

    const fragment = live.getXmlFragment("default");
    const ids: string[] = [];
    for (let i = 0; i < fragment.length; i += 1) {
      const item = fragment.get(i);
      expect(item instanceof Y.XmlElement).toBe(true);
      if (item instanceof Y.XmlElement) ids.push(item.getAttribute("blockId") ?? "");
    }
    expect(ids).toEqual(["a", "b", "c"]);
    expect(fragment.length).toBe(3);

    baseDoc.destroy();
    mineDoc.destroy();
    peerDoc.destroy();
    live.destroy();
  });
});
