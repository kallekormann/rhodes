import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { prosemirrorToYXmlFragment } from "y-prosemirror";
import * as Y from "yjs";
import { COLLAB_FRAGMENT } from "@/lib/collaboration/yjs-document";
import { extractBlockTexts } from "@/lib/offline/yjs-offline-divergence";
import { uint8ToBase64 } from "@/lib/collaboration/supabase-yjs-provider";

export const OFFLINE_CONFLICT_RESTORE_ORIGIN = "offline-conflict-restore";

/** Plain characters only — never use XmlText.toString() (it embeds <bold> tags). */
function xmlTextPlainContent(text: Y.XmlText): string {
  let out = "";
  for (const op of text.toDelta()) {
    if (typeof op.insert === "string") out += op.insert;
  }
  return out;
}

function xmlElementPlainText(el: Y.XmlElement): string {
  let out = "";
  el.forEach((child) => {
    if (child instanceof Y.XmlText) {
      out += xmlTextPlainContent(child);
    } else if (child instanceof Y.XmlElement) {
      out += xmlElementPlainText(child);
    }
  });
  return out;
}

/**
 * In-place content replace when the live block is text-only (typical paragraph).
 * Avoids delete+insert of the XmlElement, which remints CRDT identity and
 * briefly empties the peer editor ("Start writing…").
 * Copies the source XmlText delta so marks (bold/italic) from the winning
 * side are preserved — never XmlText.toString(), which embeds <bold> tags.
 * Returns false when structure is richer — caller should fall back to clone.
 *
 * When `force` is true, always rewrite even if plain text already matches —
 * required after absorbing peer updates so Keep-mine deletes concurrent peer
 * characters that happen to render the same, and so a no-op skip cannot leave
 * peer CRDT ids alive.
 */
function tryReplacePlainTextInPlace(
  live: Y.XmlElement,
  source: Y.XmlElement,
  force: boolean = false,
): boolean {
  let liveOnlyText = true;
  live.forEach((child) => {
    if (!(child instanceof Y.XmlText)) liveOnlyText = false;
  });
  if (!liveOnlyText) return false;

  let sourceOnlyText = true;
  source.forEach((child) => {
    if (!(child instanceof Y.XmlText)) sourceOnlyText = false;
  });
  if (!sourceOnlyText) return false;

  // Snapshot before mutating — plan xml may be the same live element.
  const deltas: ReturnType<Y.XmlText["toDelta"]>[] = [];
  source.forEach((child) => {
    if (child instanceof Y.XmlText) deltas.push(child.toDelta());
  });
  const plain = deltas
    .map((delta) =>
      delta
        .map((op) => (typeof op.insert === "string" ? op.insert : ""))
        .join(""),
    )
    .join("");

  if (!force && xmlElementPlainText(live) === plain) return true;

  while (live.length > 0) {
    live.delete(0, 1);
  }
  for (const delta of deltas) {
    const text = new Y.XmlText();
    if (delta.length > 0) {
      text.applyDelta(delta);
    }
    live.insert(live.length, [text]);
  }
  if (live.length === 0) {
    live.insert(0, [new Y.XmlText()]);
  }
  return true;
}

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

/**
 * Minimally patch the live fragment so its blocks match a target ("mine")
 * snapshot, without ever fully clearing and re-inserting the whole fragment.
 *
 * This exists because the review-session "mine shield" guard re-asserts the
 * offline user's snapshot on essentially every incoming peer/awareness
 * message while a conflict review is pending. Using the sledgehammer
 * delete-everything-then-reinsert-everything approach there means the live
 * document is destroyed and rebuilt from scratch dozens of times per
 * session — every rebuild is a fresh clone of every block, which is wasted
 * work and, more importantly, a much larger surface for subtle bugs (e.g.
 * duplicate/empty blocks) than patching only the blocks that actually
 * diverged.
 */
export function patchYDocBodyToSnapshot(
  liveDoc: Y.Doc,
  targetSnapshotBytes: Uint8Array,
  origin: unknown = OFFLINE_CONFLICT_RESTORE_ORIGIN,
  fragmentName: string = COLLAB_FRAGMENT,
): void {
  const targetDoc = new Y.Doc();
  Y.applyUpdate(targetDoc, targetSnapshotBytes);
  const targetFragment = targetDoc.getXmlFragment(fragmentName);
  const liveFragment = liveDoc.getXmlFragment(fragmentName);

  type TargetBlock = { blockId: string | null; item: Y.XmlElement | Y.XmlText };
  const targetBlocks: TargetBlock[] = [];
  for (let index = 0; index < targetFragment.length; index += 1) {
    const item = targetFragment.get(index);
    if (item instanceof Y.XmlElement || item instanceof Y.XmlText) {
      targetBlocks.push({
        blockId:
          item instanceof Y.XmlElement
            ? item.getAttribute("blockId") ?? null
            : null,
        item,
      });
    }
  }
  const targetIds = new Set(
    targetBlocks.map((b) => b.blockId).filter((id): id is string => id != null),
  );

  liveDoc.transact(() => {
    // Pass 1: remove any live top-level block that no longer belongs.
    for (let index = liveFragment.length - 1; index >= 0; index -= 1) {
      const item = liveFragment.get(index);
      const blockId =
        item instanceof Y.XmlElement ? item.getAttribute("blockId") : null;
      if (blockId != null && !targetIds.has(blockId)) {
        liveFragment.delete(index, 1);
      }
    }

    // Pass 2: replace content of blocks whose text diverged from the target.
    // Prefer in-place text updates to avoid reminting block identity (flicker).
    for (const target of targetBlocks) {
      if (target.blockId == null) continue;
      if (!(target.item instanceof Y.XmlElement)) continue;
      for (let index = 0; index < liveFragment.length; index += 1) {
        const liveItem = liveFragment.get(index);
        if (
          liveItem instanceof Y.XmlElement &&
          liveItem.getAttribute("blockId") === target.blockId
        ) {
          if (tryReplacePlainTextInPlace(liveItem, target.item)) {
            break;
          }
          const targetXml = target.item.toString();
          if (liveItem.toString() !== targetXml) {
            liveFragment.delete(index, 1);
            liveFragment.insert(index, [cloneXmlItem(target.item)]);
          }
          break;
        }
      }
    }

    // Pass 3: insert any target block missing entirely from the live
    // fragment, at its correct final position. Search ahead of the cursor
    // before inserting so out-of-order-but-present blocks are never
    // duplicated.
    let liveCursor = 0;
    for (const target of targetBlocks) {
      const liveItem =
        liveCursor < liveFragment.length ? liveFragment.get(liveCursor) : null;
      const liveBlockId =
        liveItem instanceof Y.XmlElement
          ? liveItem.getAttribute("blockId")
          : null;
      if (target.blockId != null && liveBlockId === target.blockId) {
        liveCursor += 1;
        continue;
      }
      if (target.blockId != null) {
        let existsAhead = false;
        for (let i = liveCursor + 1; i < liveFragment.length; i += 1) {
          const item = liveFragment.get(i);
          if (
            item instanceof Y.XmlElement &&
            item.getAttribute("blockId") === target.blockId
          ) {
            existsAhead = true;
            break;
          }
        }
        if (existsAhead) continue;
      }
      liveFragment.insert(liveCursor, [cloneXmlItem(target.item)]);
      liveCursor += 1;
    }
  }, origin);

  targetDoc.destroy();
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

/**
 * Replace the live fragment by cloning Xml blocks from source Y.Docs.
 * Avoids TipTap PM round-trips that mint empty paragraphs on commit.
 */
export function forceYDocBodyFromClonedBlocks(
  liveDoc: Y.Doc,
  blocks: Array<Y.XmlElement | Y.XmlText>,
  origin: unknown = OFFLINE_CONFLICT_RESTORE_ORIGIN,
  fragmentName: string = COLLAB_FRAGMENT,
): void {
  const liveFragment = liveDoc.getXmlFragment(fragmentName);

  liveDoc.transact(() => {
    if (liveFragment.length > 0) {
      liveFragment.delete(0, liveFragment.length);
    }
    for (let index = 0; index < blocks.length; index += 1) {
      liveFragment.insert(index, [cloneXmlItem(blocks[index])]);
    }
  }, origin);
}

/**
 * Patch the live fragment to match the resolved block plan, touching only
 * blocks that actually changed. Relies on the invariant that blocks shared
 * between "mine" (== current live state) and the resolved plan keep the same
 * relative order — only additions/removals/replacements occur, never moves.
 */
export function patchYDocBodyToResolvedBlocks(
  liveDoc: Y.Doc,
  plan: Array<{ blockId: string; side: "mine" | "peer"; xml: Y.XmlElement }>,
  origin: unknown = OFFLINE_CONFLICT_RESTORE_ORIGIN,
  fragmentName: string = COLLAB_FRAGMENT,
): void {
  const liveFragment = liveDoc.getXmlFragment(fragmentName);
  const resolvedIds = new Set(plan.map((entry) => entry.blockId));

  liveDoc.transact(() => {
    // Pass 1: drop live blocks that must not survive (e.g. dismissed peer deletes).
    for (let i = liveFragment.length - 1; i >= 0; i -= 1) {
      const item = liveFragment.get(i);
      if (!(item instanceof Y.XmlElement)) continue;
      const blockId = item.getAttribute("blockId");
      if (blockId && !resolvedIds.has(blockId)) {
        liveFragment.delete(i, 1);
      }
    }

    // Pass 2: force-assert winning-side content for every resolved block
    // (mine AND peer). After absorb, Keep-mine blocks may contain concurrent
    // peer characters; rewriting deletes those ids so the broadcast cascades.
    // Prefer in-place mutation (preserves marks); fall back to clone.
    for (let index = 0; index < liveFragment.length; index += 1) {
      const item = liveFragment.get(index);
      if (!(item instanceof Y.XmlElement)) continue;
      const blockId = item.getAttribute("blockId");
      const planEntry = plan.find((entry) => entry.blockId === blockId);
      if (!planEntry) continue;
      if (tryReplacePlainTextInPlace(item, planEntry.xml, true)) {
        continue;
      }
      liveFragment.delete(index, 1);
      liveFragment.insert(index, [cloneXmlItem(planEntry.xml)]);
    }

    // Pass 3: insert any resolved block that never existed live at all
    // (genuinely new peer-inserted blocks), at its correct final position.
    // Search ahead (not just the current cursor slot) before inserting —
    // position-only matching would insert a duplicate whenever the plan's
    // resolved order and the live fragment's current order merely differ,
    // even though the block is already present further along.
    let liveCursor = 0;
    for (const entry of plan) {
      const liveItem =
        liveCursor < liveFragment.length ? liveFragment.get(liveCursor) : null;
      const liveBlockId =
        liveItem instanceof Y.XmlElement
          ? liveItem.getAttribute("blockId")
          : null;
      if (liveBlockId === entry.blockId) {
        liveCursor += 1;
        continue;
      }
      let existsAhead = false;
      for (let i = liveCursor + 1; i < liveFragment.length; i += 1) {
        const item = liveFragment.get(i);
        if (
          item instanceof Y.XmlElement &&
          item.getAttribute("blockId") === entry.blockId
        ) {
          existsAhead = true;
          break;
        }
      }
      if (existsAhead) {
        // Already present, just out of order relative to the plan — leave it
        // where it is rather than inserting a duplicate.
        continue;
      }
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug(
          "[offline-patch] pass3 insert",
          JSON.stringify({
            blockId: entry.blockId,
            side: entry.side,
            atLiveCursor: liveCursor,
            liveFragmentLenBefore: liveFragment.length,
            expectedLiveBlockIdAtCursor: liveBlockId,
          }),
        );
      }
      liveFragment.insert(liveCursor, [cloneXmlItem(entry.xml)]);
      liveCursor += 1;
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug(
        "[offline-patch] plan summary",
        JSON.stringify(
          plan.map((e) => ({ blockId: e.blockId, side: e.side })),
        ),
        "finalFragmentLength",
        liveFragment.length,
      );
    }
  }, origin);
}

/** Find a top-level XmlElement by blockId attribute. */
export function findXmlBlockById(
  doc: Y.Doc,
  blockId: string,
  fragmentName: string = COLLAB_FRAGMENT,
): Y.XmlElement | null {
  const fragment = doc.getXmlFragment(fragmentName);
  for (let index = 0; index < fragment.length; index += 1) {
    const item = fragment.get(index);
    if (!(item instanceof Y.XmlElement)) continue;
    if (item.getAttribute("blockId") === blockId) return item;
  }
  return null;
}

/**
 * Clone a block's element shell (node name + attrs) and replace its children
 * with a single plain-text node. Used when committing a decided conflict side
 * whose canonical text must win over whatever CRDT-merged XML the peer doc
 * currently holds.
 *
 * The returned element stays integrated in `retainDoc` so later
 * `cloneXmlItem` reads during patch are valid. Caller must keep `retainDoc`
 * alive until the clone has been inserted into the live document.
 */
export function cloneXmlBlockWithPlainText(
  source: Y.XmlElement,
  plain: string,
  blockId?: string,
): { xml: Y.XmlElement; retainDoc: Y.Doc } {
  const retainDoc = new Y.Doc();
  const fragment = retainDoc.getXmlFragment("default");
  fragment.insert(0, [cloneXmlItem(source)]);
  const live = fragment.get(0) as Y.XmlElement;
  if (blockId) {
    live.setAttribute("blockId", blockId);
  }
  while (live.length > 0) {
    live.delete(0, 1);
  }
  const text = new Y.XmlText();
  if (plain.length > 0) {
    text.insert(0, plain);
  }
  live.insert(0, [text]);
  return { xml: live, retainDoc };
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
