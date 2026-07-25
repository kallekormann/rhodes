import { describe, expect, it } from "vitest";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import * as Y from "yjs";
import { uint8ToBase64 } from "@/lib/collaboration/supabase-yjs-provider";
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

function deleteBlock(doc: Y.Doc, index: number): void {
  const fragment = doc.getXmlFragment("default");
  fragment.delete(index, 1);
}

describe("peer-edit-contributions", () => {
  it("uses sender identity attached to deferred updates", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseSnapshot = {
      state: uint8ToBase64(Y.encodeStateAsUpdate(base)),
      capturedAt: new Date().toISOString(),
    };

    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, Y.encodeStateAsUpdate(base));
    const peerParagraph = peerDoc.getXmlFragment("default").get(0) as Y.XmlElement;
    const text = peerParagraph.get(0) as Y.XmlText;
    text.delete(0, text.length);
    text.insert(0, "Peer edit");

    const awareness = new Awareness(new Y.Doc());
    awareness.setLocalStateField("user", {
      id: "local-user",
      name: "You",
    });

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [
        {
          clientId: 42,
          update: Y.encodeStateAsUpdate(peerDoc, Y.encodeStateVector(base)),
          identity: {
            userId: "user-b",
            displayName: "User B",
          },
        },
      ],
      awareness,
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors).toHaveLength(1);
    expect(contributors[0].displayName).toBe("User B");
    expect(contributors[0].blockText).toBe("Peer edit");

    base.destroy();
    peerDoc.destroy();
    awareness.destroy();
  });

  it("B deletes + C idle in awareness → contributors [User B] only", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    deleteBlock(peerB, 0);

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const localDoc = new Y.Doc();
    const awareness = new Awareness(localDoc);
    awareness.setLocalStateField("user", {
      id: "local-user",
      name: "You",
    });

    // Idle peer C is present in awareness but contributed no deferred updates.
    const remoteDoc = new Y.Doc();
    const remoteAwareness = new Awareness(remoteDoc);
    remoteAwareness.setLocalStateField("user", {
      id: "user-c",
      name: "User C",
    });
    applyAwarenessUpdate(
      awareness,
      encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]),
      "test",
    );

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [
        {
          clientId: 42,
          update: Y.encodeStateAsUpdate(peerB, Y.encodeStateVector(vectorDoc)),
          identity: { userId: "user-b", displayName: "User B" },
        },
      ],
      awareness,
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors.map((entry) => entry.displayName)).toEqual(["User B"]);
    expect(contributors.map((entry) => entry.displayName)).not.toContain(
      "User C",
    );
    expect(peerContributorSummary(contributors)).toBe("User B");

    base.destroy();
    peerB.destroy();
    vectorDoc.destroy();
    localDoc.destroy();
    remoteDoc.destroy();
    remoteAwareness.destroy();
    awareness.destroy();
  });

  it("drops peers whose deferred updates leave the conflicted block unchanged", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    const peerBParagraph = peerB.getXmlFragment("default").get(0) as Y.XmlElement;
    const text = peerBParagraph.get(0) as Y.XmlText;
    text.delete(0, text.length);
    text.insert(0, "User B edit");

    const peerC = new Y.Doc();
    Y.applyUpdate(peerC, baseBytes);
    seedParagraph(peerC, "b2", "C only");

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const awareness = new Awareness(new Y.Doc());
    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [
        {
          clientId: 42,
          update: Y.encodeStateAsUpdate(peerB, Y.encodeStateVector(vectorDoc)),
          identity: { userId: "user-b", displayName: "User B" },
        },
        {
          clientId: 99,
          update: Y.encodeStateAsUpdate(peerC, Y.encodeStateVector(vectorDoc)),
          identity: { userId: "user-c", displayName: "User C" },
        },
      ],
      awareness,
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors.map((entry) => entry.displayName)).toEqual(["User B"]);
    expect(peerContributorSummary(contributors)).toBe("User B");

    base.destroy();
    peerB.destroy();
    peerC.destroy();
    vectorDoc.destroy();
    awareness.destroy();
  });

  it("uses Others for orphan updates instead of listing idle awareness peers", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseSnapshot = {
      state: uint8ToBase64(Y.encodeStateAsUpdate(base)),
      capturedAt: new Date().toISOString(),
    };

    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, Y.encodeStateAsUpdate(base));
    const peerParagraph = peerDoc.getXmlFragment("default").get(0) as Y.XmlElement;
    const text = peerParagraph.get(0) as Y.XmlText;
    text.delete(0, text.length);
    text.insert(0, "Peer edit");

    const localDoc = new Y.Doc();
    const awareness = new Awareness(localDoc);
    awareness.setLocalStateField("user", {
      id: "local-user",
      name: "You",
    });

    const remoteDoc = new Y.Doc();
    const remoteAwareness = new Awareness(remoteDoc);
    remoteAwareness.setLocalStateField("user", {
      id: "user-c",
      name: "User C",
    });
    applyAwarenessUpdate(
      awareness,
      encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]),
      "test",
    );

    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [
        {
          clientId: null,
          update: Y.encodeStateAsUpdate(peerDoc, Y.encodeStateVector(base)),
        },
      ],
      awareness,
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors).toHaveLength(1);
    expect(contributors[0].displayName).toBe("Others");
    expect(contributors.map((entry) => entry.displayName)).not.toContain(
      "User C",
    );
    expect(peerContributorSummary(contributors)).toBe("Others");

    base.destroy();
    peerDoc.destroy();
    localDoc.destroy();
    remoteDoc.destroy();
    remoteAwareness.destroy();
    awareness.destroy();
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

  it("ignores sync-step2 deferred updates when attributing parties", () => {
    const base = new Y.Doc();
    seedParagraph(base, "b1", "Original");
    const baseBytes = Y.encodeStateAsUpdate(base);
    const baseSnapshot = {
      state: uint8ToBase64(baseBytes),
      capturedAt: new Date().toISOString(),
    };

    const peerB = new Y.Doc();
    Y.applyUpdate(peerB, baseBytes);
    const peerBParagraph = peerB.getXmlFragment("default").get(0) as Y.XmlElement;
    const text = peerBParagraph.get(0) as Y.XmlText;
    text.delete(0, text.length);
    text.insert(0, "User B edit");

    const peerC = new Y.Doc();
    Y.applyUpdate(peerC, baseBytes);
    const peerCParagraph = peerC.getXmlFragment("default").get(0) as Y.XmlElement;
    const textC = peerCParagraph.get(0) as Y.XmlText;
    textC.delete(0, textC.length);
    textC.insert(0, "User B edit");

    const vectorDoc = new Y.Doc();
    Y.applyUpdate(vectorDoc, baseBytes);

    const awareness = new Awareness(new Y.Doc());
    const contributors = peerEditContributorsForBlock({
      baseSnapshot,
      deferredUpdates: [
        {
          clientId: 42,
          source: "update",
          update: Y.encodeStateAsUpdate(peerB, Y.encodeStateVector(vectorDoc)),
          identity: { userId: "user-b", displayName: "User B" },
        },
        {
          // Idle C's sync step2 would otherwise look like C edited the block.
          clientId: 99,
          source: "sync",
          update: Y.encodeStateAsUpdate(peerC, Y.encodeStateVector(vectorDoc)),
          identity: { userId: "user-c", displayName: "User C" },
        },
      ],
      awareness,
      blockId: "b1",
      blockIndex: 0,
    });

    expect(contributors.map((entry) => entry.displayName)).toEqual(["User B"]);

    base.destroy();
    peerB.destroy();
    peerC.destroy();
    vectorDoc.destroy();
    awareness.destroy();
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
