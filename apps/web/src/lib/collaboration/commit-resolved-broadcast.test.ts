import { describe, expect, it } from "vitest";
import * as Y from "yjs";

/**
 * Documents the P0 broadcast invariant without spinning up Realtime:
 * after offline edits + a resolve mutate, encoding against the *pre-offline*
 * baseline must carry the offline/resolve content to peers. Resetting the
 * baseline to "now" before that encode (the old commitResolvedDoc bug) yields
 * a no-op-sized update — peers then wait on the 8s server pull.
 */
describe("commit resolved broadcast baseline", () => {
  it("pre-offline baseline still encodes offline+resolve delta", () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("default");
    const paragraph = new Y.XmlElement("paragraph");
    paragraph.setAttribute("blockId", "a");
    const text = new Y.XmlText();
    text.insert(0, "Base");
    paragraph.insert(0, [text]);
    fragment.insert(0, [paragraph]);

    const preOfflineBaseline = Y.encodeStateVector(doc);
    const baseUpdate = Y.encodeStateAsUpdate(doc);

    text.delete(0, text.length);
    text.insert(0, "Offline");
    text.delete(0, text.length);
    text.insert(0, "Peer");

    const pending = Y.encodeStateAsUpdate(doc, preOfflineBaseline);
    const afterReset = Y.encodeStateAsUpdate(doc, Y.encodeStateVector(doc));

    expect(pending.length).toBeGreaterThan(afterReset.length);

    const peer = new Y.Doc();
    Y.applyUpdate(peer, baseUpdate);
    Y.applyUpdate(peer, pending);
    const peerText = (
      peer.getXmlFragment("default").get(0) as Y.XmlElement
    ).get(0) as Y.XmlText;
    expect(peerText.toString()).toBe("Peer");

    doc.destroy();
    peer.destroy();
  });
});
