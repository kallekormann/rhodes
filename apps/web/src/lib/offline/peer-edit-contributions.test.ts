import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { recordBlockAudit } from "@/lib/collaboration/block-audit";
import { uint8ToBase64 } from "@/lib/collaboration/supabase-yjs-provider";
import type { DeferredPeerUpdate } from "@/lib/collaboration/supabase-yjs-provider";
import {
  peerContributorSummary,
  peerEditContributorsForBlock,
  peerTouchedBlockVsBase,
  uniquePeerContributors,
} from "@/lib/offline/peer-edit-contributions";

function seedParagraph(doc: Y.Doc, blockId: string, text: string): void {
  const fragment = doc.getXmlFragment("default");
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.setAttribute("blockId", blockId);
  const xmlText = new Y.XmlText();
  xmlText.insert(0, text);
  paragraph.insert(0, [xmlText]);
  fragment.insert(fragment.length, [paragraph]);
}

function deleteBlockAt(doc: Y.Doc, index: number): void {
  const fragment = doc.getXmlFragment("default");
  fragment.delete(index, 1);
}

function editBlockText(doc: Y.Doc, index: number, text: string): void {
  const paragraph = doc.getXmlFragment("default").get(index) as Y.XmlElement;
  const xmlText = paragraph.get(0) as Y.XmlText;
  xmlText.delete(0, xmlText.length);
  xmlText.insert(0, text);
}

/** Encode a peer's doc as the delta a reconnecting client would receive. */
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

describe("peer-edit-contributions", () => {
  it("attributes a block edit to the user recorded in the block-audit trail", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    editBlockText(peerB, 0, "Peer edit");
    recordBlockAudit(peerB, ["b1"], "user-b", "User B");

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [deferredUpdateFromDoc(peerB, vectorDoc, 42)],
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors).toHaveLength(1);
    expect(contributors[0].displayName).toBe("User B");
    expect(contributors[0].userId).toBe("user-b");
    expect(contributors[0].blockText).toBe("Peer edit");

    base.destroy();
    vectorDoc.destroy();
    peerB.destroy();
  });

  it("attributes a pure block deletion (Yjs deletes carry no author metadata) via the audit trail", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    recordBlockAudit(peerB, ["b1"], "user-b", "User B");
    deleteBlockAt(peerB, 0);

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [deferredUpdateFromDoc(peerB, vectorDoc, 42)],
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors.map((c) => c.displayName)).toEqual(["User B"]);

    base.destroy();
    vectorDoc.destroy();
    peerB.destroy();
  });

  it("attributes only the real author, not a fully-synced bystander who merely relays the same change", () => {
    // B deletes block 1. C is a separate online peer who is already in sync
    // with B, so C's own catch-up reply to the reconnecting client also shows
    // block 1 deleted — but only B's browser ever wrote the audit entry.
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    recordBlockAudit(peerB, ["b1"], "user-b", "User B");
    deleteBlockAt(peerB, 0);

    // C's reply reflects the same resulting state (already synced with B)
    // but never recorded an audit entry, because C never touched the block.
    const peerC = new Y.Doc();
    Y.applyUpdate(peerC, baseBytes);
    deleteBlockAt(peerC, 0);

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [
        deferredUpdateFromDoc(peerB, vectorDoc, 42),
        deferredUpdateFromDoc(peerC, vectorDoc, 99),
      ],
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors.map((c) => c.displayName)).toEqual(["User B"]);
    expect(contributors.map((c) => c.displayName)).not.toContain("User C");
    expect(peerContributorSummary(contributors)).toBe("User B");

    base.destroy();
    vectorDoc.destroy();
    peerB.destroy();
    peerC.destroy();
  });

  it("resolves two independent conflicts in the same batch to their own distinct authors", () => {
    // B deletes block 1; C, independently, edits block 2. Both updates are
    // deferred together (a very common race on reconnect) — each block must
    // resolve to exactly the person who actually touched it.
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original one");
    seedParagraph(base, "b2", "Original two");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    recordBlockAudit(peerB, ["b1"], "user-b", "User B");
    deleteBlockAt(peerB, 0);

    const peerC = new Y.Doc();
    Y.applyUpdate(peerC, baseBytes);
    editBlockText(peerC, 1, "C's word");
    recordBlockAudit(peerC, ["b2"], "user-c", "User C");

    const deferredUpdates = [
      deferredUpdateFromDoc(peerB, vectorDoc, 42),
      deferredUpdateFromDoc(peerC, vectorDoc, 99),
    ];

    const block1Contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates,
      blockId: "b1",
      blockIndex: 0,
    });
    const block2Contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates,
      blockId: "b2",
      blockIndex: 1,
    });

    expect(block1Contributors.map((c) => c.displayName)).toEqual(["User B"]);
    expect(block2Contributors.map((c) => c.displayName)).toEqual(["User C"]);

    base.destroy();
    vectorDoc.destroy();
    peerB.destroy();
    peerC.destroy();
  });

  it("falls back to Others when the block genuinely changed but has no audit entry (pre-rollout document)", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, baseBytes);
    editBlockText(peerDoc, 0, "Peer edit");
    // No recordBlockAudit call — simulates an edit made before this feature shipped.

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [deferredUpdateFromDoc(peerDoc, vectorDoc, 42)],
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors).toHaveLength(1);
    expect(contributors[0].displayName).toBe("Others");
    expect(peerContributorSummary(contributors)).toBe("Others");

    base.destroy();
    vectorDoc.destroy();
    peerDoc.destroy();
  });

  it("drops peers whose deferred updates leave the conflicted block unchanged", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    editBlockText(peerB, 0, "User B edit");
    recordBlockAudit(peerB, ["b1"], "user-b", "User B");

    const peerC = new Y.Doc();
    Y.applyUpdate(peerC, baseBytes);
    seedParagraph(peerC, "b2", "C only");
    recordBlockAudit(peerC, ["b2"], "user-c", "User C");

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [
        deferredUpdateFromDoc(peerB, vectorDoc, 42),
        deferredUpdateFromDoc(peerC, vectorDoc, 99),
      ],
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors.map((c) => c.displayName)).toEqual(["User B"]);
    expect(peerContributorSummary(contributors)).toBe("User B");

    base.destroy();
    vectorDoc.destroy();
    peerB.destroy();
    peerC.destroy();
  });

  it("excludes the local reviewer's own userId from contributors", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, baseBytes);
    editBlockText(peerDoc, 0, "Peer edit");
    recordBlockAudit(peerDoc, ["b1"], "local-user", "You");

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [deferredUpdateFromDoc(peerDoc, vectorDoc, 42)],
      blockId: "b1",
      blockIndex: 0,
      localUserId: "local-user",
    });

    // The only audit entry belongs to the local reviewer — excluded, so this
    // is treated as unattributable rather than self-attributed.
    expect(contributors.map((c) => c.displayName)).toEqual(["Others"]);

    base.destroy();
    vectorDoc.destroy();
    peerDoc.destroy();
  });

  it("returns no contributors and no conflict when there are no deferred updates at all", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseSnapshot = {
      state: uint8ToBase64(Y.encodeStateAsUpdate(base)),
      capturedAt: new Date().toISOString(),
    };

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [],
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors).toEqual([]);
    base.destroy();
  });

  it("falls back to live ydoc audit when deferred queue is empty", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const capturedAt = new Date().toISOString();
    const baseSnapshot = {
      state: uint8ToBase64(Y.encodeStateAsUpdate(base)),
      capturedAt,
    };

    const live = new Y.Doc();
    Y.applyUpdate(live, Y.encodeStateAsUpdate(base));
    editBlockText(live, 0, "Peer edit already on live");
    recordBlockAudit(live, ["b1"], "user-c", "User C");

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [],
      blockId: "b1",
      blockIndex: 0,
      liveDoc: live,
    });

    expect(contributors.map((c) => c.displayName)).toEqual(["User C"]);
    expect(peerContributorSummary(contributors)).toBe("User C");

    base.destroy();
    live.destroy();
  });

  it("uses go-offline capturedAt so peer audit is not filtered as too old", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const goOfflineAt = "2026-07-26T14:55:00.000Z";
    const peerEditedAt = Date.parse("2026-07-26T14:55:30.000Z");
    const reconnectAt = "2026-07-26T14:56:00.000Z";

    const live = new Y.Doc();
    Y.applyUpdate(live, Y.encodeStateAsUpdate(base));
    editBlockText(live, 0, "Peer edit");
    recordBlockAudit(live, ["b1"], "user-c", "User C", peerEditedAt);

    const withGoOfflineTime = peerEditContributorsForBlock({
      baseSnapshot: {
        state: uint8ToBase64(Y.encodeStateAsUpdate(base)),
        capturedAt: goOfflineAt,
      },
      deferredUpdates: [],
      blockId: "b1",
      blockIndex: 0,
      liveDoc: live,
    });
    expect(withGoOfflineTime.map((c) => c.displayName)).toEqual(["User C"]);

    // Re-stamping capturedAt at reconnect (the old bug) makes peer edits look stale.
    const withReconnectTime = peerEditContributorsForBlock({
      baseSnapshot: {
        state: uint8ToBase64(Y.encodeStateAsUpdate(base)),
        capturedAt: reconnectAt,
      },
      deferredUpdates: [],
      blockId: "b1",
      blockIndex: 0,
      liveDoc: live,
    });
    expect(withReconnectTime).toEqual([]);
    expect(peerContributorSummary(withReconnectTime)).toBe("Others");

    base.destroy();
    live.destroy();
  });

  it("treats missing peer block as a delete touch only with a block-count drop", () => {
    expect(
      peerTouchedBlockVsBase({
        baseExisted: true,
        baseText: "Original",
        peerBlockExists: false,
        peerText: "",
        baseBlockCount: 2,
        peerBlockCount: 1,
      }),
    ).toBe(true);
    expect(
      peerTouchedBlockVsBase({
        baseExisted: true,
        baseText: "Original",
        peerBlockExists: false,
        peerText: "",
        baseBlockCount: 1,
        peerBlockCount: 1,
      }),
    ).toBe(false);
    expect(
      peerTouchedBlockVsBase({
        baseExisted: true,
        baseText: "Original",
        peerBlockExists: true,
        peerText: "Original",
      }),
    ).toBe(false);
  });

  it("dedupes contributors by user id for summaries", () => {
    const summary = peerContributorSummary(
      uniquePeerContributors([
        {
          clientId: 1,
          userId: "user-b",
          displayName: "User B",
          blockText: "a",
          blockIndex: 0,
        },
        {
          clientId: 2,
          userId: "user-b",
          displayName: "User B",
          blockText: "b",
          blockIndex: 0,
        },
        {
          clientId: 3,
          userId: "user-c",
          displayName: "User C",
          blockText: "c",
          blockIndex: 0,
        },
      ]),
    );

    expect(summary).toBe("User B and User C");
  });
});
