import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import {
  findXmlBlockById,
  forceYDocBodyFromSnapshot,
  patchYDocBodyToResolvedBlocks,
  patchYDocBodyToSnapshot,
  ydocBodyMatchesSnapshot,
} from "@/lib/offline/yjs-offline-restore";
import { uint8ToBase64 } from "@/lib/collaboration/supabase-yjs-provider";

function plainFromDoc(doc: Y.Doc): string {
  const json = yDocToProsemirrorJSON(doc, "default") as {
    content?: Array<{ content?: Array<{ text?: string }> }>;
  };
  return (json.content ?? [])
    .flatMap((block) => block.content ?? [])
    .map((node) => node.text ?? "")
    .join("\n");
}

function seedParagraphDoc(
  doc: Y.Doc,
  blocks: Array<{ blockId: string; text: string }>,
): void {
  const fragment = doc.getXmlFragment("default");
  for (const block of blocks) {
    const paragraph = new Y.XmlElement("paragraph");
    paragraph.setAttribute("blockId", block.blockId);
    const text = new Y.XmlText();
    if (block.text) text.insert(0, block.text);
    paragraph.insert(0, [text]);
    fragment.insert(fragment.length, [paragraph]);
  }
}

function blockIdsInDoc(doc: Y.Doc): string[] {
  const fragment = doc.getXmlFragment("default");
  const ids: string[] = [];
  for (let i = 0; i < fragment.length; i += 1) {
    const item = fragment.get(i);
    if (item instanceof Y.XmlElement) {
      ids.push(item.getAttribute("blockId") ?? "");
    }
  }
  return ids;
}

describe("yjs-offline-restore", () => {
  it("replaces garbled CRDT body with the frozen offline snapshot", () => {
    const base = new Y.Doc();
    const baseFragment = base.getXmlFragment("default");
    const paragraph = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    text.insert(0, "Hello world");
    paragraph.insert(0, [text]);
    baseFragment.insert(0, [paragraph]);
    const baseBytes = Y.encodeStateAsUpdate(base);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseBytes);
    const mineFragment = mine.getXmlFragment("default");
    const mineText = mineFragment
      .get(0)
      ?.get(0) as Y.XmlText;
    mineText.delete(0, mineText.length);
    mineText.insert(0, "User A overlap text");
    const mineBytes = Y.encodeStateAsUpdate(mine);

    const live = new Y.Doc();
    Y.applyUpdate(live, baseBytes);
    const liveFragment = live.getXmlFragment("default");
    const liveText = liveFragment.get(0)?.get(0) as Y.XmlText;
    liveText.delete(0, liveText.length);
    liveText.insert(0, "User B overlap textUser A overlap text");

    forceYDocBodyFromSnapshot(live, mineBytes);

    expect(plainFromDoc(live)).toBe("User A overlap text");
    expect(ydocBodyMatchesSnapshot(live, mineBytes)).toBe(true);
    expect(uint8ToBase64(Y.encodeStateAsUpdate(live))).not.toBe(
      uint8ToBase64(mineBytes),
    );

    base.destroy();
    mine.destroy();
    live.destroy();
  });

  it("patchYDocBodyToResolvedBlocks touches only the block that actually changed", () => {
    const live = new Y.Doc();
    seedParagraphDoc(live, [
      { blockId: "a", text: "A" },
      { blockId: "b", text: "B" },
      { blockId: "c", text: "C" },
    ]);

    const peer = new Y.Doc();
    seedParagraphDoc(peer, [
      { blockId: "a", text: "A" },
      { blockId: "b", text: "Peer edited B" },
      { blockId: "c", text: "C" },
    ]);

    const plan = [
      { blockId: "a", side: "mine" as const, xml: findXmlBlockById(live, "a")! },
      { blockId: "b", side: "peer" as const, xml: findXmlBlockById(peer, "b")! },
      { blockId: "c", side: "mine" as const, xml: findXmlBlockById(live, "c")! },
    ];

    let capturedUpdate: Uint8Array | null = null;
    const onUpdate = (update: Uint8Array) => {
      capturedUpdate = update;
    };
    live.on("update", onUpdate);

    patchYDocBodyToResolvedBlocks(live, plan);

    live.off("update", onUpdate);

    expect(blockIdsInDoc(live)).toEqual(["a", "b", "c"]);
    expect(plainFromDoc(live)).toBe("A\nPeer edited B\nC");

    // The broadcast delta for peers should only describe the changed block
    // (block "b"), never a and c — otherwise every peer sees a full-document
    // replace (visible flash / stray empty blocks) for an untouched block.
    if (!capturedUpdate) throw new Error("expected an update event");
    const decoded = Y.decodeUpdate(capturedUpdate) as {
      structs: Array<{ id: { client: number } }>;
    };
    // The cloned replacement is integrated as new local content on `live`
    // (a clone is a detached, freshly-created item until inserted), so the
    // check that matters is that exactly one struct-author shows up at all —
    // a full-fragment rebuild would instead touch every block's structs.
    const touchedClientIds = new Set(
      decoded.structs.map((struct) => struct.id.client),
    );
    expect(touchedClientIds.size).toBe(1);
    expect(touchedClientIds.has(live.clientID)).toBe(true);

    live.destroy();
    peer.destroy();
  });

  it("patchYDocBodyToResolvedBlocks does not add empty blocks when block 1 (index 0) is the conflicted one", () => {
    // Reproduces the reported symptom: conflict on the very first block of
    // the document, "peer" side wins — verify no stray empty blocks appear
    // at the top (or anywhere) of the resulting document.
    const live = new Y.Doc();
    seedParagraphDoc(live, [
      { blockId: "a", text: "Mine A" },
      { blockId: "b", text: "B" },
      { blockId: "c", text: "C" },
    ]);

    const peer = new Y.Doc();
    seedParagraphDoc(peer, [
      { blockId: "a", text: "Peer A" },
      { blockId: "b", text: "B" },
      { blockId: "c", text: "C" },
    ]);

    const plan = [
      { blockId: "a", side: "peer" as const, xml: findXmlBlockById(peer, "a")! },
      { blockId: "b", side: "mine" as const, xml: findXmlBlockById(live, "b")! },
      { blockId: "c", side: "mine" as const, xml: findXmlBlockById(live, "c")! },
    ];

    patchYDocBodyToResolvedBlocks(live, plan);

    expect(blockIdsInDoc(live)).toEqual(["a", "b", "c"]);
    expect(plainFromDoc(live)).toBe("Peer A\nB\nC");
    // No stray empty paragraphs anywhere in the document.
    const fragment = live.getXmlFragment("default");
    for (let i = 0; i < fragment.length; i += 1) {
      const item = fragment.get(i);
      expect(item instanceof Y.XmlElement).toBe(true);
    }
    expect(fragment.length).toBe(3);

    live.destroy();
    peer.destroy();
  });

  it("keep-mine force rewrite purges absorbed peer characters and cascades to peer doc", () => {
    const base = new Y.Doc();
    seedParagraphDoc(base, [{ blockId: "a", text: "Hello" }]);
    const baseUpdate = Y.encodeStateAsUpdate(base);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseUpdate);
    const mineEl = findXmlBlockById(mine, "a")!;
    const mineText = mineEl.get(0) as Y.XmlText;
    mineText.delete(0, mineText.length);
    mineText.insert(0, "Mine keep");
    const mineOnlyUpdate = Y.encodeStateAsUpdate(mine);

    const peer = new Y.Doc();
    Y.applyUpdate(peer, baseUpdate);
    const peerEl = findXmlBlockById(peer, "a")!;
    const peerTextNode = peerEl.get(0) as Y.XmlText;
    peerTextNode.delete(0, peerTextNode.length);
    peerTextNode.insert(0, "Peer online");

    // Absorb peer into mine (commitResolvedDoc step 1).
    Y.applyUpdate(mine, Y.encodeStateAsUpdate(peer));

    const mineOnly = new Y.Doc();
    Y.applyUpdate(mineOnly, mineOnlyUpdate);
    const mineXml = findXmlBlockById(mineOnly, "a")!;

    // Keep-mine force-assert (commitResolvedDoc step 2 / Pass2).
    patchYDocBodyToResolvedBlocks(mine, [
      { blockId: "a", side: "mine", xml: mineXml },
    ]);
    expect(plainFromDoc(mine)).toBe("Mine keep");

    // Cascade to peer via baseline-relative update (broadcastPendingLocalUpdates).
    const cascade = Y.encodeStateAsUpdate(mine, Y.encodeStateVector(peer));
    Y.applyUpdate(peer, cascade);
    expect(plainFromDoc(peer)).toBe("Mine keep");

    base.destroy();
    mine.destroy();
    peer.destroy();
    mineOnly.destroy();
  });

  it("force rewrite does not embed XmlText.toString() bold tags as literal text", () => {
    const base = new Y.Doc();
    seedParagraphDoc(base, [{ blockId: "a", text: "Base" }]);
    const baseUpdate = Y.encodeStateAsUpdate(base);

    const live = new Y.Doc();
    Y.applyUpdate(live, baseUpdate);
    const peer = new Y.Doc();
    Y.applyUpdate(peer, baseUpdate);
    const peerText = (findXmlBlockById(peer, "a")!.get(0) as Y.XmlText);
    peerText.delete(0, peerText.length);
    peerText.insert(0, "Peer");
    Y.applyUpdate(live, Y.encodeStateAsUpdate(peer));

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseUpdate);
    const mineText = findXmlBlockById(mine, "a")!.get(0) as Y.XmlText;
    mineText.delete(0, mineText.length);
    mineText.insert(0, "Mine bold", { bold: true });

    // Y.XmlText.toString() would be "<bold>Mine bold</bold>" — must not land in doc.
    expect(mineText.toString()).toContain("bold");

    patchYDocBodyToResolvedBlocks(live, [
      { blockId: "a", side: "mine", xml: findXmlBlockById(mine, "a")! },
    ]);

    expect(plainFromDoc(live)).toBe("Mine bold");
    expect(plainFromDoc(live)).not.toContain("<bold>");
    expect(plainFromDoc(live)).not.toContain("</bold>");

    base.destroy();
    live.destroy();
    peer.destroy();
    mine.destroy();
  });

  it("patchYDocBodyToResolvedBlocks keeps XmlElement identity for plain-text peer replace", () => {
    const live = new Y.Doc();
    seedParagraphDoc(live, [
      { blockId: "a", text: "Mine A" },
      { blockId: "b", text: "B" },
    ]);
    const peer = new Y.Doc();
    seedParagraphDoc(peer, [
      { blockId: "a", text: "Peer A" },
      { blockId: "b", text: "B" },
    ]);

    const before = findXmlBlockById(live, "a");
    expect(before).not.toBeNull();

    patchYDocBodyToResolvedBlocks(live, [
      { blockId: "a", side: "peer", xml: findXmlBlockById(peer, "a")! },
      { blockId: "b", side: "mine", xml: findXmlBlockById(live, "b")! },
    ]);

    const after = findXmlBlockById(live, "a");
    expect(after).toBe(before);
    expect(plainFromDoc(live)).toBe("Peer A\nB");

    live.destroy();
    peer.destroy();
  });

  it("patchYDocBodyToResolvedBlocks does not add empty blocks when 'mine' wins on block 1", () => {
    const live = new Y.Doc();
    seedParagraphDoc(live, [
      { blockId: "a", text: "Mine A" },
      { blockId: "b", text: "B" },
      { blockId: "c", text: "C" },
    ]);

    const peer = new Y.Doc();
    seedParagraphDoc(peer, [
      { blockId: "a", text: "Peer A" },
      { blockId: "b", text: "B" },
      { blockId: "c", text: "C" },
    ]);

    const plan = [
      { blockId: "a", side: "mine" as const, xml: findXmlBlockById(live, "a")! },
      { blockId: "b", side: "mine" as const, xml: findXmlBlockById(live, "b")! },
      { blockId: "c", side: "mine" as const, xml: findXmlBlockById(live, "c")! },
    ];

    patchYDocBodyToResolvedBlocks(live, plan);

    expect(blockIdsInDoc(live)).toEqual(["a", "b", "c"]);
    expect(plainFromDoc(live)).toBe("Mine A\nB\nC");
    expect(live.getXmlFragment("default").length).toBe(3);

    live.destroy();
    peer.destroy();
  });

  it("patchYDocBodyToSnapshot re-asserts a target snapshot without leaving stray/empty blocks, even when called repeatedly", () => {
    // Mirrors the review-session "mine shield" guard: it re-runs on almost
    // every incoming peer/awareness message while a review is pending. This
    // reproduces that churn — a peer update slips a block into `live`, then
    // the guard re-asserts the mine snapshot, over and over.
    const mine = new Y.Doc();
    seedParagraphDoc(mine, [
      { blockId: "a", text: "Mine A" },
      { blockId: "b", text: "Mine B" },
      { blockId: "c", text: "Mine C" },
    ]);
    const mineBytes = Y.encodeStateAsUpdate(mine);

    const live = new Y.Doc();
    seedParagraphDoc(live, [
      { blockId: "a", text: "Mine A" },
      { blockId: "b", text: "Mine B" },
      { blockId: "c", text: "Mine C" },
    ]);

    for (let i = 0; i < 5; i += 1) {
      // Simulate a leaked peer edit landing on the live doc between guard
      // passes.
      const target = findXmlBlockById(live, "b");
      if (target) {
        const child = target.get(0);
        if (child instanceof Y.XmlText) {
          child.insert(child.length, ` leak${i}`);
        }
      }
      patchYDocBodyToSnapshot(live, mineBytes);
    }

    expect(blockIdsInDoc(live)).toEqual(["a", "b", "c"]);
    expect(plainFromDoc(live)).toBe("Mine A\nMine B\nMine C");
    expect(live.getXmlFragment("default").length).toBe(3);
    expect(ydocBodyMatchesSnapshot(live, mineBytes)).toBe(true);

    mine.destroy();
    live.destroy();
  });

  it("patchYDocBodyToSnapshot only touches the diverged block, leaving untouched blocks' structs alone", () => {
    const mine = new Y.Doc();
    seedParagraphDoc(mine, [
      { blockId: "a", text: "A" },
      { blockId: "b", text: "B" },
      { blockId: "c", text: "C" },
    ]);
    const mineBytes = Y.encodeStateAsUpdate(mine);

    const live = new Y.Doc();
    seedParagraphDoc(live, [
      { blockId: "a", text: "A" },
      { blockId: "b", text: "Diverged B" },
      { blockId: "c", text: "C" },
    ]);

    let capturedUpdate: Uint8Array | null = null;
    const onUpdate = (update: Uint8Array) => {
      capturedUpdate = update;
    };
    live.on("update", onUpdate);

    patchYDocBodyToSnapshot(live, mineBytes);

    live.off("update", onUpdate);

    expect(blockIdsInDoc(live)).toEqual(["a", "b", "c"]);
    expect(plainFromDoc(live)).toBe("A\nB\nC");

    if (!capturedUpdate) throw new Error("expected an update event");
    const decoded = Y.decodeUpdate(capturedUpdate) as {
      structs: Array<{ id: { client: number } }>;
    };
    const touchedClientIds = new Set(
      decoded.structs.map((struct) => struct.id.client),
    );
    expect(touchedClientIds.size).toBe(1);

    mine.destroy();
    live.destroy();
  });
});
