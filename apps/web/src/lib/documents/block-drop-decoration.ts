import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { isNoOpDrop, getTopLevelBlockInsertPos, getDocBlockIndexForDomIndex } from "@/lib/documents/block-drag";

export const blockDropPluginKey = new PluginKey<DecorationSet>("blockDrop");

function createDropWidget(): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "editor-block-drop-slot";
  slot.contentEditable = "false";
  slot.setAttribute("aria-hidden", "true");

  const zone = document.createElement("div");
  zone.className = "block-drop-zone block-drop-zone--accent";
  zone.textContent = "Drop here";
  slot.appendChild(zone);

  return slot;
}

export function createBlockDropPlugin() {
  return new Plugin<DecorationSet>({
    key: blockDropPluginKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, set) {
        const next = tr.getMeta(blockDropPluginKey);
        if (next !== undefined) return next;
        return set.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return blockDropPluginKey.getState(state) ?? DecorationSet.empty;
      },
    },
  });
}

export function getBlockInsertPos(editor: Editor, blockIndex: number): number {
  return getTopLevelBlockInsertPos(editor.state.doc, blockIndex);
}

export function syncDropDecoration(
  editor: Editor,
  dragIndex: number,
  dropIndex: number,
) {
  const { state, view } = editor;

  if (isNoOpDrop(dragIndex, dropIndex)) {
    view.dispatch(state.tr.setMeta(blockDropPluginKey, DecorationSet.empty));
    return;
  }

  const docDropIndex = getDocBlockIndexForDomIndex(editor, dropIndex) ?? dropIndex;
  const pos = getBlockInsertPos(editor, docDropIndex);
  const widget = Decoration.widget(pos, createDropWidget, {
    side: -1,
    key: "block-drop-widget",
  });
  const decorations = DecorationSet.create(state.doc, [widget]);
  view.dispatch(state.tr.setMeta(blockDropPluginKey, decorations));
}

export function clearDropDecoration(editor: Editor) {
  const { state, view } = editor;
  view.dispatch(state.tr.setMeta(blockDropPluginKey, DecorationSet.empty));
}
