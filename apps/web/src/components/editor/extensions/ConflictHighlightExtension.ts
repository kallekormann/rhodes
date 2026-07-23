import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { BlockConflict } from "@/lib/offline/yjs-offline-divergence";
import { getTopLevelBlockRangeForConflict } from "@/lib/documents/block-positions";
import type { CharRange } from "@/lib/offline/conflict-highlight-ranges";

export const conflictHighlightKey = new PluginKey("rhodesConflictHighlight");

export type ConflictHighlightState = {
  active: BlockConflict | null;
  conflicts: BlockConflict[];
};

type ConflictHighlightStorage = {
  state: ConflictHighlightState;
  refresh: (next: ConflictHighlightState) => void;
};

function mapCharRangeToDoc(
  blockFrom: number,
  blockNode: ProseMirrorNode,
  start: number,
  end: number,
): { from: number; to: number } | null {
  if (end <= start) return null;

  let charIndex = 0;
  let from = -1;
  let to = -1;

  blockNode.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const len = node.text.length;
    const nodeEndChar = charIndex + len;

    if (from < 0 && start < nodeEndChar) {
      from = pos + Math.max(0, start - charIndex);
    }
    if (to < 0 && end <= nodeEndChar) {
      to = pos + Math.max(0, end - charIndex);
    }

    charIndex += len;
  });

  if (from >= 0 && to > from) {
    return { from, to };
  }

  const contentStart = blockFrom + 1;
  const blockTextLength = blockNode.textContent.length;
  return {
    from: contentStart + Math.max(0, start),
    to: contentStart + Math.min(blockTextLength, end),
  };
}

function mapCharRangesToDoc(
  blockFrom: number,
  blockNode: ProseMirrorNode,
  ranges: CharRange[],
): Array<{ from: number; to: number }> {
  const positions: Array<{ from: number; to: number }> = [];
  for (const range of ranges) {
    const mapped = mapCharRangeToDoc(blockFrom, blockNode, range.start, range.end);
    if (mapped) positions.push(mapped);
  }
  return positions;
}

function buildConflictDecorations(
  doc: ProseMirrorNode,
  state: ConflictHighlightState,
): DecorationSet {
  const decorations: Decoration[] = [];
  const activeId = state.active?.blockId ?? null;
  const activeIndex = state.active?.blockIndex ?? null;

  for (const conflict of state.conflicts) {
    const block = getTopLevelBlockRangeForConflict(doc, conflict);
    if (!block) continue;

    const isActive =
      conflict.blockId === activeId && conflict.blockIndex === activeIndex;

    decorations.push(
      Decoration.node(block.from, block.to, {
        class: isActive
          ? "editor-conflict-block editor-conflict-block--active"
          : "editor-conflict-block editor-conflict-block--pending",
      }),
    );

    if (!isActive || !state.active) continue;

    const charRanges: CharRange[] = [
      {
        start: state.active.highlightStart,
        end: state.active.highlightEnd,
      },
    ];

    for (const { from, to } of mapCharRangesToDoc(block.from, block.node, charRanges)) {
      decorations.push(
        Decoration.inline(from, to, {
          class: "editor-conflict-highlight",
        }),
      );
    }
  }

  if (decorations.length === 0) return DecorationSet.empty;
  return DecorationSet.create(doc, decorations);
}

export const ConflictHighlightExtension = Extension.create<
  Record<string, never>,
  ConflictHighlightStorage
>({
  name: "rhodesConflictHighlight",

  addStorage() {
    return {
      state: { active: null, conflicts: [] },
      refresh: () => undefined,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: conflictHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const mapped = old.map(tr.mapping, tr.doc);
            const next = tr.getMeta(conflictHighlightKey) as DecorationSet | undefined;
            return next ?? mapped;
          },
        },
        props: {
          decorations(state) {
            return conflictHighlightKey.getState(state);
          },
        },
        view(view) {
          const applyState = (next: ConflictHighlightState) => {
            extension.storage.state = next;
            view.dispatch(
              view.state.tr.setMeta(
                conflictHighlightKey,
                buildConflictDecorations(view.state.doc, next),
              ),
            );
          };

          extension.storage.refresh = applyState;
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
