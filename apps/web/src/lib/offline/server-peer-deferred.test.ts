import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  detectOfflineBlockConflicts,
  extractBlockTexts,
} from "@/lib/offline/yjs-offline-divergence";

/**
 * Mirrors SupabaseYjsProvider.queueServerStateAsDeferredPeer:
 * base ⊕ server → delta relative to base SV (durable peer truth when Realtime blips).
 */
function serverDeltaFromBase(
  baseUpdate: Uint8Array,
  baseVector: Uint8Array,
  serverUpdate: Uint8Array,
): Uint8Array {
  const shadow = new Y.Doc();
  Y.applyUpdate(shadow, baseUpdate);
  Y.applyUpdate(shadow, serverUpdate);
  const delta = Y.encodeStateAsUpdate(shadow, baseVector);
  shadow.destroy();
  return delta;
}

function seedParagraph(
  doc: Y.Doc,
  blockId: string,
  text: string,
): void {
  const fragment = doc.getXmlFragment("default");
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.setAttribute("blockId", blockId);
  const node = new Y.XmlText();
  node.insert(0, text);
  paragraph.insert(0, [node]);
  fragment.insert(0, [paragraph]);
}

describe("server peer deferred (Realtime fallback)", () => {
  it("GET /yjs-shaped server delta surfaces both_edited for conflict UI", () => {
    const base = new Y.Doc();
    seedParagraph(base, "a", "Hello world");
    const baseUpdate = Y.encodeStateAsUpdate(base);
    const baseVector = Y.encodeStateVector(base);

    const server = new Y.Doc();
    Y.applyUpdate(server, baseUpdate);
    const serverText = (
      server.getXmlFragment("default").get(0) as Y.XmlElement
    ).get(0) as Y.XmlText;
    serverText.delete(0, serverText.length);
    serverText.insert(0, "Hello peer");
    const serverUpdate = Y.encodeStateAsUpdate(server);

    const mine = new Y.Doc();
    Y.applyUpdate(mine, baseUpdate);
    const mineText = (
      mine.getXmlFragment("default").get(0) as Y.XmlElement
    ).get(0) as Y.XmlText;
    mineText.delete(0, mineText.length);
    mineText.insert(0, "Hello mine");

    const delta = serverDeltaFromBase(baseUpdate, baseVector, serverUpdate);
    expect(delta.length).toBeGreaterThan(0);

    const peerDoc = new Y.Doc();
    Y.applyUpdate(peerDoc, baseUpdate);
    Y.applyUpdate(peerDoc, delta);
    expect(extractBlockTexts(peerDoc).get("a")?.text).toBe("Hello peer");

    const merged = new Y.Doc();
    Y.applyUpdate(merged, Y.encodeStateAsUpdate(mine));
    Y.applyUpdate(merged, delta);

    const found = detectOfflineBlockConflicts(base, mine, peerDoc, merged, {
      catchupComplete: true,
    });
    expect(found.map((c) => c.blockId)).toEqual(["a"]);
    expect(found[0]?.kind).toBe("both_edited");

    base.destroy();
    server.destroy();
    mine.destroy();
    peerDoc.destroy();
    merged.destroy();
  });
});
