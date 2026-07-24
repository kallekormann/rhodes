import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import {
  forceYDocBodyFromSnapshot,
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
});
