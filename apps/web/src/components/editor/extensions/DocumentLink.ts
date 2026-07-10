import Link from "@tiptap/extension-link";

export const DocumentLink = Link.extend({
  name: "link",

  addAttributes() {
    return {
      ...this.parent?.(),
      linkKind: {
        default: "external",
        parseHTML: (element) =>
          element.getAttribute("data-link-kind") ?? "external",
        renderHTML: (attributes) => ({
          "data-link-kind": attributes.linkKind ?? "external",
        }),
      },
      linkLabel: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-link-label"),
        renderHTML: (attributes) => {
          if (!attributes.linkLabel) return {};
          return { "data-link-label": attributes.linkLabel };
        },
      },
    };
  },
});
