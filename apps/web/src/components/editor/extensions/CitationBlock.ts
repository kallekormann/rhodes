import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CitationBlockView } from "./CitationBlockView";

export const CitationBlock = Node.create({
  name: "citation",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      sourceId: { default: null },
      sourceTitle: { default: "" },
      page: { default: null },
      excerpt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'blockquote[data-type="citation"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "blockquote",
      mergeAttributes(HTMLAttributes, {
        "data-type": "citation",
        class: "editor-citation",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CitationBlockView);
  },
});
