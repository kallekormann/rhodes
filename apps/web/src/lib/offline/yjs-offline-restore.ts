import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { prosemirrorToYXmlFragment } from "y-prosemirror";
import * as Y from "yjs";
import { COLLAB_FRAGMENT } from "@/lib/collaboration/yjs-document";
import { extractBlockTexts } from "@/lib/offline/yjs-offline-divergence";
import { uint8ToBase64 } from "@/lib/collaboration/supabase-yjs-provider";

export const OFFLINE_CONFLICT_RESTORE_ORIGIN = "offline-conflict-restore";

function cloneXmlItem(item: Y.XmlElement | Y.XmlText): Y.XmlElement | Y.XmlText {
  if (item instanceof Y.XmlElement) {
    const clone = new Y.XmlElement(item.nodeName);
    for (const [key, value] of Object.entries(item.getAttributes())) {
      clone.setAttribute(key, value);
    }
    item.forEach((child) => {
      if (child instanceof Y.XmlElement || child instanceof Y.XmlText) {
        clone.insert(clone.length, [cloneXmlItem(child)]);
      }
    });
    return clone;
  }

  const text = new Y.XmlText();
  const delta = item.toDelta();
  if (delta.length > 0) {
    text.applyDelta(delta);
  }
  return text;
}

/**
 * Replace the live collaboration fragment with a frozen offline snapshot.
 * Deletes and re-inserts top-level nodes so peer CRDT character merges cannot survive.
 */
export function forceYDocBodyFromSnapshot(
  liveDoc: Y.Doc,
  snapshotBytes: Uint8Array,
  origin: unknown = OFFLINE_CONFLICT_RESTORE_ORIGIN,
  fragmentName: string = COLLAB_FRAGMENT,
): void {
  const mineDoc = new Y.Doc();
  Y.applyUpdate(mineDoc, snapshotBytes);
  const mineFragment = mineDoc.getXmlFragment(fragmentName);
  const liveFragment = liveDoc.getXmlFragment(fragmentName);

  liveDoc.transact(() => {
    if (liveFragment.length > 0) {
      liveFragment.delete(0, liveFragment.length);
    }
    for (let index = 0; index < mineFragment.length; index += 1) {
      const item = mineFragment.get(index);
      if (item instanceof Y.XmlElement || item instanceof Y.XmlText) {
        liveFragment.insert(index, [cloneXmlItem(item)]);
      }
    }
  }, origin);

  mineDoc.destroy();
}

/** Replace the live collaboration fragment from the current ProseMirror document. */
export function forceYDocBodyFromProsemirrorDoc(
  liveDoc: Y.Doc,
  pmDoc: ProseMirrorNode,
  origin: unknown = OFFLINE_CONFLICT_RESTORE_ORIGIN,
  fragmentName: string = COLLAB_FRAGMENT,
): void {
  const liveFragment = liveDoc.getXmlFragment(fragmentName);

  liveDoc.transact(() => {
    if (liveFragment.length > 0) {
      liveFragment.delete(0, liveFragment.length);
    }
    prosemirrorToYXmlFragment(pmDoc, liveFragment);
  }, origin);
}

/** Semantic body check — Yjs byte encoding can differ while block text matches. */
export function ydocBodyMatchesSnapshot(
  liveDoc: Y.Doc,
  snapshotBytes: Uint8Array,
): boolean {
  const mineDoc = new Y.Doc();
  Y.applyUpdate(mineDoc, snapshotBytes);
  const liveBlocks = extractBlockTexts(liveDoc);
  const mineBlocks = extractBlockTexts(mineDoc);
  mineDoc.destroy();

  if (liveBlocks.size !== mineBlocks.size) return false;
  for (const [blockId, mineBlock] of mineBlocks) {
    const liveBlock = liveBlocks.get(blockId);
    if (!liveBlock || liveBlock.text !== mineBlock.text) return false;
  }
  return true;
}

export function snapshotBytesFromDoc(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function snapshotBase64FromDoc(doc: Y.Doc): string {
  return uint8ToBase64(snapshotBytesFromDoc(doc));
}

export function snapshotDocFromBytes(bytes: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, bytes);
  return doc;
}
