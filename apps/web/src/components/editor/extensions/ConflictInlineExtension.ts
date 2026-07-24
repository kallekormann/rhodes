import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { getTopLevelBlockRangeForConflict } from "@/lib/documents/block-positions";
import { mapBlockCharRangeToDoc } from "@/lib/documents/block-positions";
import type { BlockReviewModel, ReviewSegment } from "@/lib/offline/base-aligned-review";
import type { ConflictReviewColors } from "@/lib/offline/conflict-review-colors";
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

function cssVars(colors: ConflictReviewColors): string {
  return [
    `--conflict-mine:${colors.mine}`,
    `--conflict-mine-muted:${colors.mineMuted}`,
    `--conflict-mine-strong:${colors.mineStrong}`,
    `--conflict-peer:${colors.peer}`,
    `--conflict-peer-muted:${colors.peerMuted}`,
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

  span.className = [
    "editor-conflict-phantom",
    isPeer ? "editor-conflict-phantom--peer" : "editor-conflict-phantom--mine",
    segment.role.endsWith("_del") ? "editor-conflict-phantom--del" : "editor-conflict-phantom--add",
    segment.clickable ? "editor-conflict-clickable" : "",
    active ? "editor-conflict-phantom--active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  span.style.cssText = cssVars(colors);
  span.textContent = segment.text;

  if (segment.clusterId) {
    span.dataset.clusterId = segment.clusterId;
  }

  return span;
}

function inlineClassForSegment(
  segment: ReviewSegment,
  activeClusterId: string | null,
): string {
  const active = segment.clusterId === activeClusterId;
  switch (segment.role) {
    case "context":
      return "editor-conflict-context";
    case "mine_add":
      return active
        ? "editor-conflict-mine-add editor-conflict-mine-add--active editor-conflict-clickable"
        : "editor-conflict-mine-add editor-conflict-clickable";
    default:
      return "editor-conflict-context";
  }
}

function buildReviewDecorations(
  doc: ProseMirrorNode,
  review: BlockReviewModel,
  colors: ConflictReviewColors,
  activeClusterId: string | null,
): Decoration[] {
  const block = getTopLevelBlockRangeForConflict(doc, review);
  if (!block) return [];

  const decorations: Decoration[] = [];
  const contentStart = block.from + 1;
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

    const mapped = mapBlockCharRangeToDoc(
      block.from,
      block.node,
      mineOffset,
      mineOffset + segment.text.length,
    );
    if (!mapped) continue;

    const attrs: Record<string, string> = {
      class: inlineClassForSegment(segment, activeClusterId),
      style: cssVars(colors),
    };
    if (segment.clusterId) {
      attrs["data-cluster-id"] = segment.clusterId;
    }

    decorations.push(Decoration.inline(mapped.from, mapped.to, attrs));
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
