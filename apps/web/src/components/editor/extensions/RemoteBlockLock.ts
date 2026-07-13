import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { readBlockId } from "@/lib/documents/block-ids";

const remoteBlockLockKey = new PluginKey("remoteBlockLock");

function findBlockRange(
  doc: import("@tiptap/pm/model").Node,
  blockId: string,
): { from: number; to: number } | null {
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const id = readBlockId(node);
    const start = pos;
    const end = pos + node.nodeSize;
    if (id === blockId) {
      return { from: start, to: end };
    }
    pos = end;
  }
  return null;
}

function transactionTouchesRange(
  tr: import("@tiptap/pm/state").Transaction,
  range: { from: number; to: number },
): boolean {
  if (!tr.docChanged) return false;
  let touches = false;
  tr.steps.forEach((step) => {
    const map = step.getMap();
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      if (newStart < range.to && newEnd > range.from) {
        touches = true;
      }
    });
  });
  return touches;
}

export const RemoteBlockLock = Extension.create<{
  lockedBlockId: string | null;
  lockedByName: string | null;
}>({
  name: "remoteBlockLock",

  addOptions() {
    return {
      lockedBlockId: null,
      lockedByName: null,
    };
  },

  addProseMirrorPlugins() {
    const getOptions = () => this.options;

    return [
      new Plugin({
        key: remoteBlockLockKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, _old, _oldState, newState) {
            const { lockedBlockId, lockedByName } = getOptions();
            if (!lockedBlockId) return DecorationSet.empty;

            const range = findBlockRange(newState.doc, lockedBlockId);
            if (!range) return DecorationSet.empty;

            const decoration = Decoration.node(range.from, range.to, {
              class: "editor-block--remote-lock",
              "data-remote-editor": lockedByName
                ? `${lockedByName} is editing`
                : "Someone is editing",
            });

            return DecorationSet.create(newState.doc, [decoration]);
          },
        },
        props: {
          decorations(state) {
            return remoteBlockLockKey.getState(state);
          },
        },
        filterTransaction(tr) {
          const { lockedBlockId } = getOptions();
          if (!lockedBlockId) return true;
          const range = findBlockRange(tr.doc, lockedBlockId);
          if (!range) return true;
          return !transactionTouchesRange(tr, range);
        },
      }),
    ];
  },
});
