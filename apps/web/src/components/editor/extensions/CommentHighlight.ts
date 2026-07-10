import { Mark, mergeAttributes } from "@tiptap/core";

export const CommentHighlight = Mark.create({
  name: "commentHighlight",

  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => ({
          "data-comment-id": attributes.commentId,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "editor-comment-highlight",
      }),
      0,
    ];
  },
});
