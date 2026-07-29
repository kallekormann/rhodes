import Image from "@tiptap/extension-image";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  imageServeUrl,
  resolveDocumentImageAttrs,
} from "@/lib/documents/document-image-urls";
import "@/components/Loader.css";
import "./DocumentImage.css";

const repairKey = new PluginKey("documentImageAttrs");

function createLoadingSpinner(): HTMLElement {
  const loader = document.createElement("span");
  loader.className = "loader loader--s document-image-block__loader";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-label", "Loading image");

  const ring = document.createElement("span");
  ring.className = "loader__ring";
  ring.setAttribute("aria-hidden", "true");

  const track = document.createElement("span");
  track.className = "loader__track";
  track.setAttribute("aria-hidden", "true");

  loader.append(ring, track);
  return loader;
}

function createUploadProgressBar(): {
  track: HTMLDivElement;
  fill: HTMLDivElement;
} {
  const track = document.createElement("div");
  track.className = "document-image-block__upload-progress";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", "0");
  track.setAttribute("aria-label", "Image upload progress");

  const fill = document.createElement("div");
  fill.className = "document-image-block__upload-progress-fill";
  track.append(fill);

  return { track, fill };
}

function createImageNodeView(initialNode: { attrs: Record<string, unknown> }) {
  let node = initialNode;
  const wrapper = document.createElement("div");
  wrapper.className = "document-image-block";
  wrapper.contentEditable = "false";

  const frame = document.createElement("div");
  frame.className = "document-image-block__frame";

  const uploadOverlay = document.createElement("div");
  uploadOverlay.className = "document-image-block__upload-overlay";
  uploadOverlay.hidden = true;

  const { track: uploadProgressTrack, fill: uploadProgressFill } =
    createUploadProgressBar();
  const uploadLabel = Object.assign(document.createElement("span"), {
    className: "document-image-block__upload-label",
    textContent: "Uploading…",
  });
  uploadOverlay.append(uploadProgressTrack, uploadLabel);

  const placeholder = document.createElement("div");
  placeholder.className = "document-image-block__placeholder";
  placeholder.append(
    createLoadingSpinner(),
    Object.assign(document.createElement("span"), {
      className: "document-image-block__label",
      textContent: "Loading image…",
    }),
  );

  const img = document.createElement("img");
  img.className = "document-image-block__img";
  img.decoding = "async";

  let loadedSrc: string | null = null;

  const setUploading = (active: boolean) => {
    wrapper.dataset.uploading = active ? "true" : "false";
    uploadOverlay.hidden = !active;
  };

  const applyUploadProgress = () => {
    const progress =
      typeof node.attrs.uploadProgress === "number"
        ? Math.min(100, Math.max(0, node.attrs.uploadProgress))
        : 0;
    uploadProgressTrack.setAttribute("aria-valuenow", String(progress));
    uploadProgressFill.style.width = `${Math.max(progress, progress > 0 ? 3 : 0)}%`;
    uploadLabel.textContent =
      progress >= 100 ? "Finishing…" : `Uploading ${progress}%`;
  };

  const markLoaded = () => {
    if (wrapper.dataset.uploading === "true") {
      wrapper.dataset.loading = "false";
      return;
    }
    wrapper.dataset.loading = "false";
    wrapper.dataset.error = "false";
    if (img.src) loadedSrc = img.src;
  };

  const markError = () => {
    wrapper.dataset.loading = "false";
    wrapper.dataset.error = "true";
    const label = placeholder.querySelector(".document-image-block__label");
    if (label) label.textContent = "Couldn't load image";
    const spinner = placeholder.querySelector(".document-image-block__loader");
    spinner?.remove();
  };

  const applySrc = (src: string | null) => {
    if (!src) {
      img.removeAttribute("src");
      loadedSrc = null;
      markError();
      return;
    }

    if (loadedSrc === src && wrapper.dataset.error !== "true") {
      markLoaded();
      return;
    }

    if (img.getAttribute("src") !== src) {
      wrapper.dataset.loading = "true";
      wrapper.dataset.error = "false";
      const label = placeholder.querySelector(".document-image-block__label");
      if (label) label.textContent = "Loading image…";
      if (!placeholder.querySelector(".document-image-block__loader")) {
        placeholder.prepend(createLoadingSpinner());
      }
      img.src = src;
    }

    if (img.complete && img.naturalWidth > 0) {
      markLoaded();
    }
  };

  const apply = () => {
    const uploading = node.attrs.uploading === true;
    const rawSrc =
      typeof node.attrs.src === "string" ? node.attrs.src.trim() : "";
    const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";

    if (uploading || rawSrc.startsWith("blob:")) {
      wrapper.removeAttribute("data-storage-path");
      img.alt = alt;
      if (uploading) {
        setUploading(true);
        wrapper.dataset.loading = "false";
        wrapper.dataset.error = "false";
        if (rawSrc && img.getAttribute("src") !== rawSrc) {
          img.src = rawSrc;
        }
        applyUploadProgress();
        return;
      }
      setUploading(false);
      const label = placeholder.querySelector(".document-image-block__label");
      if (label) label.textContent = "Loading image…";
      applySrc(rawSrc || null);
      return;
    }

    setUploading(false);
    const { storagePath, src } = resolveDocumentImageAttrs(node.attrs);
    if (storagePath) {
      wrapper.dataset.storagePath = storagePath;
    } else {
      wrapper.removeAttribute("data-storage-path");
    }
    img.alt = alt;
    applySrc(src);
  };

  img.addEventListener("load", markLoaded);
  img.addEventListener("error", markError);

  frame.append(img, uploadOverlay);
  wrapper.append(frame, placeholder);
  apply();

  return {
    dom: wrapper,
    update(updatedNode: { type: { name: string }; attrs: Record<string, unknown> }) {
      if (updatedNode.type.name !== "image") return false;
      node = updatedNode;
      apply();
      return true;
    },
    destroy() {
      img.removeEventListener("load", markLoaded);
      img.removeEventListener("error", markError);
    },
  };
}

export const DocumentImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        keepOnSplit: true,
        parseHTML: (element) => {
          const storagePath = element.getAttribute("data-storage-path");
          if (storagePath) return imageServeUrl(storagePath);
          return element.getAttribute("src");
        },
        renderHTML: (attributes) => {
          const { src } = resolveDocumentImageAttrs(attributes);
          return src ? { src } : {};
        },
      },
      storagePath: {
        default: null,
        keepOnSplit: true,
        parseHTML: (element) => element.getAttribute("data-storage-path"),
        renderHTML: (attributes) => {
          if (!attributes.storagePath) return {};
          return { "data-storage-path": attributes.storagePath };
        },
      },
      uploading: {
        default: false,
        keepOnSplit: false,
      },
      uploadId: {
        default: null,
        keepOnSplit: false,
      },
      uploadProgress: {
        default: null,
        keepOnSplit: false,
      },
    };
  },

  addNodeView() {
    return ({ node }: { node: { attrs: Record<string, unknown> } }) =>
      createImageNodeView(node);
  },

  addProseMirrorPlugins() {
    let repaired = false;

    return [
      new Plugin({
        key: repairKey,
        appendTransaction(_transactions, _oldState, newState) {
          if (repaired) return null;

          let tr = newState.tr;
          let changed = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "image") return;
            if (node.attrs.uploading === true) return;

            const { storagePath, src } = resolveDocumentImageAttrs(node.attrs);
            if (!storagePath || !src) return;

            const needsPath = node.attrs.storagePath !== storagePath;
            const needsSrc = node.attrs.src !== src;
            if (!needsPath && !needsSrc) return;

            tr = tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              storagePath,
              src,
            });
            changed = true;
          });

          repaired = true;
          return changed ? tr : null;
        },
      }),
    ];
  },
});
