import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  getTopLevelBlockRangeForConflict,
  mapBlockCharRangeToDoc,
} from "@/lib/documents/block-positions";
import {
  conflictCharRangesForBlock,
  shiftCharRangesToDisplayText,
  type CharRange,
} from "@/lib/offline/conflict-highlight-ranges";
import type {
  SpanConflictCluster,
  SpanConflictVariantSide,
} from "@/lib/offline/span-conflict-clusters";

export const conflictInlineKey = new PluginKey("rhodesConflictInline");

export type ConflictInlineState = {
  clusters: SpanConflictCluster[];
  activeClusterId: string | null;
};

type ConflictInlineStorage = {
  state: ConflictInlineState;
  refresh: (next: ConflictInlineState) => void;
  onActivate?: (clusterId: string) => void;
};

function normalizeHighlightRanges(
  ranges: CharRange[],
  textLength: number,
): CharRange[] {
  return ranges
    .map((range) => {
      const start = Math.max(0, Math.min(range.start, textLength));
      const end = Math.max(start, Math.min(range.end, textLength));
      if (end > start) return { start, end };
      if (start < textLength) return { start, end: start + 1 };
      return null;
    })
    .filter((range): range is CharRange => range != null);
}

function highlightRangesForCluster(
  cluster: SpanConflictCluster,
  blockText: string,
): CharRange[] {
  const snapshotText = cluster.mineText;
  const displayText = blockText || snapshotText;
  const blockRanges = conflictCharRangesForBlock({
    baseText: cluster.baseText,
    mineText: snapshotText,
    theirsText: cluster.theirsText,
  });

  let ranges: CharRange[];
  if (
    displayText === snapshotText ||
    displayText.trim() === snapshotText.trim()
  ) {
    const precomputed: CharRange = {
      start: cluster.highlightStart,
      end: cluster.highlightEnd,
    };
    ranges =
      precomputed.end > precomputed.start
        ? [precomputed]
        : blockRanges.length > 0
          ? blockRanges
          : [{ start: 0, end: snapshotText.length }];
  } else {
    ranges = shiftCharRangesToDisplayText(
      blockRanges,
      snapshotText,
      displayText,
    );
  }

  return normalizeHighlightRanges(
    ranges.length > 0 ? ranges : blockRanges,
    displayText.length,
  );
}

function buildConflictDecorations(
  doc: ProseMirrorNode,
  state: ConflictInlineState,
): DecorationSet {
  const decorations: Decoration[] = [];

  for (const cluster of state.clusters) {
    const block = getTopLevelBlockRangeForConflict(doc, cluster);
    if (!block) continue;

    const isActive = cluster.id === state.activeClusterId;

    for (const { start, end } of highlightRangesForCluster(cluster, block.text)) {
      const mapped = mapBlockCharRangeToDoc(block.from, block.node, start, end);
      if (!mapped) continue;
      decorations.push(
        Decoration.inline(mapped.from, mapped.to, {
          class: isActive
            ? "editor-conflict-span editor-conflict-span--active"
            : "editor-conflict-span",
          "data-cluster-id": cluster.id,
        }),
      );
    }
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
      state: { clusters: [], activeClusterId: null },
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

export type { SpanConflictVariantSide };
