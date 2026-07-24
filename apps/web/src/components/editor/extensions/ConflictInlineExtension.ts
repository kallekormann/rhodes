import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { getTopLevelBlockRangeForConflict } from "@/lib/documents/block-positions";
import { mapBlockCharRangeToDoc } from "@/lib/documents/block-positions";
import {
  clusterMineHighlightOffsets,
  type BlockReviewModel,
  type ReviewSegment,
} from "@/lib/offline/base-aligned-review";
import {
  conflictReviewColors,
  peerColorsForUser,
  type ConflictReviewColors,
} from "@/lib/offline/conflict-review-colors";
import type { SpanConflictCluster } from "@/lib/offline/span-conflict-clusters";

export const conflictInlineKey = new PluginKey("rhodesConflictInline");

export type ConflictInlineState = {
  clusters: SpanConflictCluster[];
  reviews: BlockReviewModel[];
  colors: ConflictReviewColors | null;
  activeClusterId: string | null;
};

type ConflictInlineStorage = {
  state: ConflictInlineState;
  refresh: (next: ConflictInlineState) => void;
  onActivate?: (clusterId: string) => void;
};

function cssVars(colors: {
  mine: string;
  mineMuted: string;
  mineStrong: string;
}): string {
  return [
    `--conflict-mine:${colors.mine}`,
    `--conflict-mine-muted:${colors.mineMuted}`,
    `--conflict-mine-strong:${colors.mineStrong}`,
  ].join(";");
}

function peerCssVars(peerUserId: string | undefined, colors: ConflictReviewColors): string {
  const peer = peerColorsForUser(colors, peerUserId);
  return [
    `--conflict-peer:${peer.color}`,
    `--conflict-peer-muted:${peer.muted}`,
    `--conflict-peer-strong:${peer.strong}`,
  ].join(";");
}

function createPhantomElement(
  segment: ReviewSegment,
  colors: ConflictReviewColors,
  activeClusterId: string | null,
): HTMLElement {
  const span = document.createElement("span");
  const isPeer = segment.role.startsWith("peer");
  const active = segment.clusterId === activeClusterId;
  const peerPalette = peerColorsForUser(colors, segment.peerUserId);

  span.className = [
    "editor-conflict-phantom",
    isPeer ? "editor-conflict-phantom--peer" : "editor-conflict-phantom--mine",
    segment.role.endsWith("_del") ? "editor-conflict-phantom--del" : "editor-conflict-phantom--add",
    segment.clickable ? "editor-conflict-clickable" : "",
    active ? "editor-conflict-phantom--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isPeer) {
    span.style.cssText = peerCssVars(segment.peerUserId, colors);
  } else {
    span.style.cssText = cssVars(colors);
  }

  span.textContent = segment.text;

  if (segment.clusterId) {
    span.dataset.clusterId = segment.clusterId;
  }
  if (segment.peerUserId) {
    span.dataset.peerUserId = segment.peerUserId;
  }

  return span;
}

function buildReviewDecorations(
  doc: ProseMirrorNode,
  review: BlockReviewModel,
  blockClusters: SpanConflictCluster[],
  colors: ConflictReviewColors,
  activeClusterId: string | null,
): Decoration[] {
  const block = getTopLevelBlockRangeForConflict(doc, review);
  if (!block) return [];

  const decorations: Decoration[] = [];
  const contentStart = block.from + 1;
  const blockClusterIds = blockClusters
    .filter((cluster) => cluster.blockId === review.blockId)
    .map((cluster) => cluster.id);

  for (const clusterId of blockClusterIds) {
    const band = clusterMineHighlightOffsets(review, clusterId);
    if (band) {
      const mapped = mapBlockCharRangeToDoc(
        block.from,
        block.node,
        band.start,
        band.end,
      );
      if (mapped) {
        const active = clusterId === activeClusterId;
        decorations.push(
          Decoration.inline(mapped.from, mapped.to, {
            class: active
              ? "editor-conflict-mine-band editor-conflict-mine-band--active editor-conflict-clickable"
              : "editor-conflict-mine-band editor-conflict-clickable",
            style: cssVars(colors),
            "data-cluster-id": clusterId,
          }),
        );
      }
    }
  }

  let mineOffset = 0;
  for (const segment of review.segments) {
    if (segment.phantom) {
      const pos = contentStart + mineOffset;
      decorations.push(
        Decoration.widget(
          pos,
          () => createPhantomElement(segment, colors, activeClusterId),
          { side: -1, key: `${review.blockId}:${segment.id}` },
        ),
      );
      continue;
    }

    if (segment.role === "context") {
      const mapped = mapBlockCharRangeToDoc(
        block.from,
        block.node,
        mineOffset,
        mineOffset + segment.text.length,
      );
      if (mapped) {
        decorations.push(
          Decoration.inline(mapped.from, mapped.to, {
            class: "editor-conflict-context",
          }),
        );
      }
    }

    mineOffset += segment.text.length;
  }

  return decorations;
}

function buildConflictDecorations(
  doc: ProseMirrorNode,
  state: ConflictInlineState,
): DecorationSet {
  if (!state.colors) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  for (const review of state.reviews) {
    decorations.push(
      ...buildReviewDecorations(
        doc,
        review,
        state.clusters,
        state.colors,
        state.activeClusterId,
      ),
    );
  }

  if (decorations.length === 0) return DecorationSet.empty;
  return DecorationSet.create(doc, decorations);
}

function clusterIdFromClickTarget(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  const span = target.closest("[data-cluster-id]");
  if (!(span instanceof HTMLElement)) return null;
  return span.dataset.clusterId ?? null;
}

export const ConflictInlineExtension = Extension.create<
  {
    onActivate?: (clusterId: string) => void;
  },
  ConflictInlineStorage
>({
  name: "rhodesConflictInline",

  addOptions() {
    return {
      onActivate: undefined,
    };
  },

  addStorage() {
    return {
      state: {
        clusters: [],
        reviews: [],
        colors: null,
        activeClusterId: null,
      },
      refresh: () => undefined,
      onActivate: undefined,
    };
  },

  onCreate() {
    this.storage.onActivate = this.options.onActivate;
  },

  onUpdate() {
    this.storage.onActivate = this.options.onActivate;
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: conflictInlineKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const mapped = old.map(tr.mapping, tr.doc);
            const next = tr.getMeta(conflictInlineKey) as DecorationSet | undefined;
            return next ?? mapped;
          },
        },
        props: {
          decorations(state) {
            return conflictInlineKey.getState(state);
          },
          handleDOMEvents: {
            click(_view, event) {
              const clusterId = clusterIdFromClickTarget(event.target);
              if (!clusterId) return false;
              extension.storage.onActivate?.(clusterId);
              event.preventDefault();
              event.stopPropagation();
              return true;
            },
          },
        },
        view(view) {
          const applyState = (next: ConflictInlineState) => {
            extension.storage.state = next;
            view.dispatch(
              view.state.tr.setMeta(
                conflictInlineKey,
                buildConflictDecorations(view.state.doc, next),
              ),
            );
          };

          extension.storage.refresh = applyState;
          extension.storage.onActivate = extension.options.onActivate;
          applyState(extension.storage.state);

          return {
            update(updatedView, prevState) {
              if (updatedView.state.doc.eq(prevState.doc)) return;
              applyState(extension.storage.state);
            },
            destroy() {
              extension.storage.refresh = () => undefined;
            },
          };
        },
      }),
    ];
  },
});

// Re-export for callers that build default palettes in tests.
export { conflictReviewColors };
