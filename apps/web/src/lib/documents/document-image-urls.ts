const DOCUMENT_IMAGES_BUCKET = "document-images";

const STORAGE_PATH_MARKERS = [
  `/object/sign/${DOCUMENT_IMAGES_BUCKET}/`,
  `/object/authenticated/${DOCUMENT_IMAGES_BUCKET}/`,
  `/object/public/${DOCUMENT_IMAGES_BUCKET}/`,
  `/${DOCUMENT_IMAGES_BUCKET}/`,
] as const;

export function imageServeUrl(storagePath: string): string {
  return `/app/api/documents/images/serve?path=${encodeURIComponent(storagePath)}`;
}

export function extractDocumentImageStoragePath(
  src: string | null | undefined,
): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith("blob:")) return null;

  try {
    const url = new URL(trimmed, "http://localhost");
    const fromServe = url.searchParams.get("path");
    if (fromServe) return fromServe;

    for (const marker of STORAGE_PATH_MARKERS) {
      const idx = url.pathname.indexOf(marker);
      if (idx >= 0) {
        return decodeURIComponent(url.pathname.slice(idx + marker.length));
      }
    }
  } catch {
    /* fall through */
  }

  if (trimmed.includes("/") && !trimmed.startsWith("http")) {
    return trimmed;
  }

  return null;
}

export function resolveDocumentImageAttrs(attrs: Record<string, unknown>): {
  storagePath: string | null;
  src: string | null;
} {
  const storagePath =
    (typeof attrs.storagePath === "string" && attrs.storagePath.trim()) ||
    extractDocumentImageStoragePath(
      typeof attrs.src === "string" ? attrs.src : null,
    );

  if (!storagePath) {
    const src = typeof attrs.src === "string" ? attrs.src.trim() : "";
    return { storagePath: null, src: src || null };
  }

  return {
    storagePath,
    src: imageServeUrl(storagePath),
  };
}

/** Omit images still uploading (blob preview) from Postgres / IDB projections. */
export function stripInFlightDocumentImages(
  content: Record<string, unknown>,
): Record<string, unknown> {
  const cloned = structuredClone(content);

  function cleanNodes(nodes: unknown[]): unknown[] {
    const next: unknown[] = [];
    for (const child of nodes) {
      if (!child || typeof child !== "object") {
        next.push(child);
        continue;
      }
      const node = child as Record<string, unknown>;
      if (node.type === "image") {
        const attrs = (node.attrs as Record<string, unknown> | undefined) ?? {};
        const src = typeof attrs.src === "string" ? attrs.src : "";
        if (attrs.uploading === true || src.startsWith("blob:")) {
          continue;
        }
      }
      if (Array.isArray(node.content)) {
        node.content = cleanNodes(node.content);
      }
      next.push(node);
    }
    return next;
  }

  if (Array.isArray(cloned.content)) {
    cloned.content = cleanNodes(cloned.content);
  }
  return cloned;
}

function collectDocumentImageStoragePaths(
  content: Record<string, unknown>,
): string[] {
  const paths: string[] = [];

  function walk(node: Record<string, unknown>) {
    if (node.type === "image") {
      const attrs = (node.attrs as Record<string, unknown> | undefined) ?? {};
      const storagePath =
        (typeof attrs.storagePath === "string" && attrs.storagePath) ||
        extractDocumentImageStoragePath(
          typeof attrs.src === "string" ? attrs.src : null,
        );
      if (storagePath) paths.push(storagePath);
    }
    const children = node.content;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === "object") {
          walk(child as Record<string, unknown>);
        }
      }
    }
  }

  walk(content);
  return [...new Set(paths)];
}

/** Warm the browser cache while the editor shell is still mounting. */
export function prefetchDocumentImages(content: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  for (const storagePath of collectDocumentImageStoragePaths(content)) {
    const img = new Image();
    img.decoding = "async";
    img.src = imageServeUrl(storagePath);
  }
}
