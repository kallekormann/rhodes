import { Node, mergeAttributes } from "@tiptap/core";

export const RhodesSuggestion = Node.create({
  name: "rhodesSuggestion",
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      label: { default: "Rhodes suggests" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="rhodes-suggestion"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "rhodes-suggestion",
        class: "rhodes-suggestion",
      }),
      [
        "span",
        { class: "rhodes-suggestion__label", contenteditable: "false" },
        node.attrs.label as string,
      ],
      ["div", { class: "rhodes-suggestion__body" }, 0],
    ];
  },
});
