import Image from "@tiptap/extension-image";

export const DocumentImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      ...this.parent?.(),
      storagePath: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-storage-path"),
        renderHTML: (attributes) => {
          if (!attributes.storagePath) return {};
          return { "data-storage-path": attributes.storagePath };
        },
      },
    };
  },
});
