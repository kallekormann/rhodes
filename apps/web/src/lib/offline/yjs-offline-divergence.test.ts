import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { threeWayMergeText } from "@/lib/documents/text-diff";
import {
  blockNeedsConflictReview,
  detectOfflineBlockConflicts,
  isOfflineMergeSettled,
  offlineSessionHasOnlyLocalEdits,
  peerTouchedBlock,
  resolveTheirsForOfflineConflict,
} from "@/lib/offline/yjs-offline-divergence";

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
  const fragment = doc.getXmlFragment("default");
  const paragraph = fragment.get(index) as Y.XmlElement;
  const xmlText = paragraph.get(0) as Y.XmlText;
  xmlText.delete(0, xmlText.length);
  xmlText.insert(0, text);
}

function deleteBlock(doc: Y.Doc, index: number): void {
  const fragment = doc.getXmlFragment("default");
  fragment.delete(index, 1);
}

describe("offline Yjs block overlap detection", () => {
  it("auto-merges when only one side changed", () => {
    const result = threeWayMergeText(
      "Hello world",
      "Hello offline",
      "Hello world",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("Hello offline");
    }
  });

  it("flags Case C when both sides edited the same span differently", () => {
    const result = threeWayMergeText(
      "Hello world",
      "Hello offline edit",
      "Hello online edit",
    );
    expect(result.ok).toBe(false);
  });

  it("flags Hello offline vs Hi online on same greeting", () => {
    const base = "HELLO HI! more pass no pass?";
    const mine = "HELLO HI! Hello offline pass no pass?";
    const theirs = "HELLO HI! Hi online pass no pass?";
    const result = threeWayMergeText(base, mine, theirs);
    expect(result.ok).toBe(false);
  });

  it("auto-merges prepend and append on the same block", () => {
    const result = threeWayMergeText(
      "world",
      "hello world",
      "world today",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("hello");
      expect(result.text).toContain("today");
    }
  });

  it("treats CRDT garble as conflict when clean merge differs from merged", () => {
    const base = "HELLO HI! more pass";
    const mine = "HELLO HI! Hello offline pass";
    const theirs = "HELLO HI! Hi online pass";
    const merge = threeWayMergeText(base, mine, theirs);
    const merged = "HELLO HI! HHi onlinello offline pass";
    const needsReview = !merge.ok || (merge.ok && merge.text !== merged);
    expect(needsReview).toBe(true);
  });

  it("flags silent peer win when merged equals online version", () => {
    const base = "Lets add other big same content";
    const mine = "Lets add other big HELLO FROM OFFLINE content";
    const theirs = "Lets add other big HELLO FROM ONLINE content";
    const merged = theirs;
    const merge = threeWayMergeText(base, mine, theirs);
    const peerWonSilently =
      mine !== base && mine !== theirs && merged === theirs;
    const needsReview =
      peerWonSilently || !merge.ok || (merge.ok && merge.text !== merged);
    expect(peerWonSilently).toBe(true);
    expect(needsReview).toBe(true);
  });

  it("does not review peer-only block edits (UAT step 3 — different blocks)", () => {
    const base = "Original block two text";
    const mine = base;
    const theirs = "Original block two text edited by peer online";
    const merged = theirs;

    expect(
      blockNeedsConflictReview(base, mine, theirs, merged, true),
    ).toBe(false);
  });

  it("does not review clean auto-merge on offline-edited block when peer left it alone", () => {
    const base = "Block one original";
    const mine = "Block one offline edit";
    const theirs = base;
    const merged = mine;

    expect(
      blockNeedsConflictReview(base, mine, theirs, merged, true, {
        peerTouched: false,
      }),
    ).toBe(false);
  });

  it("does not review when CRDT merged text drifts but peer did not edit this block", () => {
    const base = "Block one original";
    const mine = "Block one offline edit";
    const theirs = base;
    const mergedWithNoise = "Block one offline edit "; // trailing space from CRDT

    expect(
      blockNeedsConflictReview(base, mine, theirs, mergedWithNoise, true, {
        peerTouched: false,
      }),
    ).toBe(false);
  });

  it("resolveTheirs uses base when peer did not touch an offline-edited block", () => {
    expect(
      resolveTheirsForOfflineConflict(
        "block one base",
        "block one mine",
        "block one polluted from yjs",
        false,
      ),
    ).toBe("block one base");
  });

  it("reviews overlapping edits on the same block (UAT step 4)", () => {
    const base = "Hello world";
    const mine = "Hello offline edit";
    const theirs = "Hello online edit";
    const merged = "Hello offline online edit";

    expect(
      blockNeedsConflictReview(base, mine, theirs, merged, true, {
        kind: "both_edited",
        peerTouched: true,
      }),
    ).toBe(true);
  });

  it("S1 solo: no conflict when peer did not touch", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    setBlockText(mine, 0, "Offline solo edit");

    const peer = new Y.Doc();
    Y.applyUpdate(peer, baseBytes);

    const conflicts = detectOfflineBlockConflicts(base, mine, peer, mine, {
      catchupComplete: true,
    });
    expect(conflicts).toHaveLength(0);
    expect(offlineSessionHasOnlyLocalEdits(base, mine, peer)).toBe(true);

    base.destroy();
    mine.destroy();
    peer.destroy();
  });

  it("S2 different blocks: no conflict", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Block one");
    seedParagraph(base, "b2", "Block two");
    const baseBytes = Y.encodeStateAsUpdate(base);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    setBlockText(mine, 0, "Block one offline");

    const peer = new Y.Doc();
    Y.applyUpdate(peer, baseBytes);
    setBlockText(peer, 1, "Block two online");

    const conflicts = detectOfflineBlockConflicts(base, mine, peer, undefined, {
      catchupComplete: true,
    });
    expect(conflicts).toHaveLength(0);

    base.destroy();
    mine.destroy();
    peer.destroy();
  });

  it("S4 mine edit + peer delete detection", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    setBlockText(mine, 0, "Mine kept editing");

    const peer = new Y.Doc();
    Y.applyUpdate(peer, baseBytes);
    deleteBlock(peer, 0);

    expect(peerTouchedBlock("b1", base, peer)).toBe(true);

    const conflicts = detectOfflineBlockConflicts(base, mine, peer, undefined, {
      catchupComplete: true,
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("mine_edited_peer_deleted");
    expect(conflicts[0].blockId).toBe("b1");

    base.destroy();
    mine.destroy();
    peer.destroy();
  });

  it("S13 settled when only local edits", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    setBlockText(mine, 0, "Local only");

    const peer = new Y.Doc();
    Y.applyUpdate(peer, baseBytes);

    // Shielded merge still equals mine — must still settle for solo.
    expect(offlineSessionHasOnlyLocalEdits(base, mine, peer)).toBe(true);
    expect(isOfflineMergeSettled(base, mine, peer, mine)).toBe(true);

    base.destroy();
    mine.destroy();
    peer.destroy();
  });

  it("no false delete from empty deferred (same block count, missing noisy id)", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);

    const peer = new Y.Doc();
    Y.applyUpdate(peer, baseBytes);
    // Replace with a different blockId — same top-level count, noisy missing id.
    deleteBlock(peer, 0);
    seedParagraph(peer, "b-noise", "Original");

    expect(peerTouchedBlock("b1", base, peer)).toBe(false);
    expect(peerTouchedBlock("missing-noise-id", base, peer)).toBe(false);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    setBlockText(mine, 0, "Mine edit");

    const conflicts = detectOfflineBlockConflicts(base, mine, peer, undefined, {
      catchupComplete: true,
    });
    expect(conflicts.some((c) => c.kind === "mine_edited_peer_deleted")).toBe(
      false,
    );

    base.destroy();
    mine.destroy();
    peer.destroy();
  });

  it("structural delete kinds require peerTouched for review", () => {
    expect(
      blockNeedsConflictReview("base", "mine", "", undefined, true, {
        kind: "mine_edited_peer_deleted",
        peerTouched: false,
      }),
    ).toBe(false);
    expect(
      blockNeedsConflictReview("base", "mine", "", undefined, true, {
        kind: "mine_edited_peer_deleted",
        peerTouched: true,
      }),
    ).toBe(true);
  });

  it("same-word peer edit stays both_edited when deferred sync is base-relative", () => {
    // A edits block1 offline + same word in block2; C edits that word online.
    // Peer delta must be encoded vs BASE (not live) so block2 stays present.
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Block one original");
    seedParagraph(base, "b2", "shared word here");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseVector = Y.encodeStateVector(base);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    setBlockText(mine, 0, "Block one offline");
    setBlockText(mine, 1, "shared OFFLINE here");

    const peer = new Y.Doc();
    Y.applyUpdate(peer, baseBytes);
    setBlockText(peer, 1, "shared ONLINE here");

    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, baseBytes);
    Y.applyUpdate(peerDoc, Y.encodeStateAsUpdate(peer, baseVector));

    const conflicts = detectOfflineBlockConflicts(
      base,
      mine,
      peerDoc,
      undefined,
      { catchupComplete: true },
    );
    const block2 = conflicts.find((c) => c.blockId === "b2");
    expect(block2?.kind).toBe("both_edited");
    expect(conflicts.some((c) => c.kind === "mine_edited_peer_deleted")).toBe(
      false,
    );

    base.destroy();
    mine.destroy();
    peer.destroy();
    peerDoc.destroy();
  });

  it("peer delete of another block does not mark shifted blocks as deleted", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Block one");
    seedParagraph(base, "b2", "Block two");
    const baseBytes = Y.encodeStateAsUpdate(base);

    const peer = new Y.Doc();
    Y.applyUpdate(peer, baseBytes);
    deleteBlock(peer, 0);

    expect(peerTouchedBlock("b1", base, peer)).toBe(true);
    expect(peerTouchedBlock("b2", base, peer)).toBe(false);

    base.destroy();
    peer.destroy();
  });

  it("TD-001 wave 1: only peer delete deferred — block 2 not misclassified as delete", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Block one original");
    seedParagraph(base, "b2", "shared word here");
    const baseBytes = Y.encodeStateAsUpdate(base);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    setBlockText(mine, 0, "Block one offline");
    setBlockText(mine, 1, "shared OFFLINE here");

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    deleteBlock(peerB, 0);

    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, baseBytes);
    Y.applyUpdate(
      peerDoc,
      Y.encodeStateAsUpdate(peerB, Y.encodeStateVector(vectorDoc)),
    );

    const wave1 = detectOfflineBlockConflicts(
      base,
      mine,
      peerDoc,
      undefined,
      { catchupComplete: true },
    );

    expect(wave1.some((c) => c.blockId === "b1")).toBe(true);
    expect(
      wave1.some(
        (c) => c.blockId === "b2" && c.kind === "mine_edited_peer_deleted",
      ),
    ).toBe(false);

    const peerC = new Y.Doc();
    Y.applyUpdate(peerC, baseBytes);
    setBlockText(peerC, 1, "shared ONLINE here");
    Y.applyUpdate(
      peerDoc,
      Y.encodeStateAsUpdate(peerC, Y.encodeStateVector(vectorDoc)),
    );

    const wave2 = detectOfflineBlockConflicts(
      base,
      mine,
      peerDoc,
      undefined,
      { catchupComplete: true },
    );
    const block2 = wave2.find((c) => c.blockId === "b2");
    expect(block2?.kind).toBe("both_edited");

    base.destroy();
    mine.destroy();
    peerB.destroy();
    peerC.destroy();
    peerDoc.destroy();
    vectorDoc.destroy();
  });

  it("TD-001: block delete + same-word edit — block 2 stays both_edited", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Block one original");
    seedParagraph(base, "b2", "shared word here");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseVector = Y.encodeStateVector(base);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    setBlockText(mine, 0, "Block one offline");
    setBlockText(mine, 1, "shared OFFLINE here");

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    deleteBlock(peerB, 0);

    const peerC = new Y.Doc();
    Y.applyUpdate(peerC, baseBytes);
    setBlockText(peerC, 1, "shared ONLINE here");

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

    const block1 = conflicts.find((c) => c.blockId === "b1");
    const block2 = conflicts.find((c) => c.blockId === "b2");

    expect(block1?.kind).toBe("mine_edited_peer_deleted");
    expect(block2?.kind).toBe("both_edited");
    expect(peerTouchedBlock("b2", base, peerDoc)).toBe(true);
    expect(
      conflicts.some(
        (c) => c.blockId === "b2" && c.kind === "mine_edited_peer_deleted",
      ),
    ).toBe(false);

    base.destroy();
    mine.destroy();
    peerB.destroy();
    peerC.destroy();
    peerDoc.destroy();
    vectorDoc.destroy();
  });

  it("blank peer doc (outbound leak wipe) misclassifies same-word edit as peer delete", () => {
    // When A's mine-shield restores leak and blank B/C, their catch-up looks
    // like every block was deleted — detection must not treat that as truth
    // once peer reconstruction is fixed, but this documents the cascade.
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Block one original");
    seedParagraph(base, "b2", "shared word here");
    const baseBytes = Y.encodeStateAsUpdate(base);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    setBlockText(mine, 0, "Block one offline");
    setBlockText(mine, 1, "shared OFFLINE here");

    const blankPeer = new Y.Doc();
    // Empty body — TipTap shows "Start writing…"

    const conflicts = detectOfflineBlockConflicts(
      base,
      mine,
      blankPeer,
      undefined,
      { catchupComplete: true },
    );
    expect(
      conflicts.some(
        (c) => c.blockId === "b2" && c.kind === "mine_edited_peer_deleted",
      ),
    ).toBe(true);

    base.destroy();
    mine.destroy();
    blankPeer.destroy();
  });
});
