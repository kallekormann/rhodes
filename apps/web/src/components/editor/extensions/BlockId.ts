import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  BLOCK_ID_TRANSACTION_META,
  buildBlockIdTransaction,
  collectMissingTopLevelBlockIds,
} from "@/lib/documents/block-ids";

export { ensureEditorBlockIds } from "@/lib/documents/block-ids";

const blockIdPluginKey = new PluginKey("blockId");

const BLOCK_NODE_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "horizontalRule",
  "codeBlock",
  "bulletList",
  "orderedList",
  "table",
  "image",
  "citation",
] as const;

export const BlockId = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: [...BLOCK_NODE_TYPES],
        attributes: {
          blockId: {
            default: null,
            rendered: true,
            keepOnSplit: false,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) => {
              if (!attributes.blockId) return {};
              return { "data-block-id": attributes.blockId };
            },
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: blockIdPluginKey,
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          if (
            transactions.some((tr) => tr.getMeta(BLOCK_ID_TRANSACTION_META))
          ) {
            return null;
          }

          const updates = collectMissingTopLevelBlockIds(newState.doc);
          return buildBlockIdTransaction(editor, updates, newState.tr);
        },
      }),
    ];
  },
});
