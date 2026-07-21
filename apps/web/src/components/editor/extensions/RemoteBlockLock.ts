import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { readBlockId } from "@/lib/documents/block-ids";
import {
  buildRemoteCursorDecorations,
  type RemoteCollaboratorCursor,
} from "@/components/editor/extensions/remote-cursor-decorations";

export const remoteCollaborationKey = new PluginKey("remoteCollaboration");
export const REMOTE_DOCUMENT_SYNC_META = "remoteDocumentSync";

export type RemoteCollaborationMeta = {
  lockedBlockId: string | null;
  lockedBlockIndex: number | null;
  lockedSelectionFrom: number | null;
  lockedByName: string | null;
  remoteCursors: RemoteCollaboratorCursor[];
};

type RemoteCollaborationPluginState = {
  collaboration: RemoteCollaborationMeta;
  decorations: DecorationSet;
};

const emptyCollaboration = (): RemoteCollaborationMeta => ({
  lockedBlockId: null,
  lockedBlockIndex: null,
  lockedSelectionFrom: null,
  lockedByName: null,
  remoteCursors: [],
});

function findBlockRangeById(
  doc: import("@tiptap/pm/model").Node,
  blockId: string,
): { from: number; to: number } | null {
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const id = readBlockId(node);
    const start = pos;
    const end = pos + node.nodeSize;
    if (id === blockId) {
      return { from: start, to: end };
    }
    pos = end;
  }
  return null;
}

function findBlockRangeByIndex(
  doc: import("@tiptap/pm/model").Node,
  blockIndex: number,
): { from: number; to: number } | null {
  if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= doc.childCount) {
    return null;
  }

  let pos = 0;
  for (let i = 0; i < blockIndex; i++) {
    pos += doc.child(i).nodeSize;
  }

  const node = doc.child(blockIndex);
  return { from: pos, to: pos + node.nodeSize };
}

function findBlockIndexAtPosition(
  doc: import("@tiptap/pm/model").Node,
  pos: number,
): number | null {
  if (doc.childCount === 0) return null;

  const safePos = Math.max(1, Math.min(pos, doc.content.size));
  let blockPos = 0;

  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const end = blockPos + node.nodeSize;
    if (safePos >= blockPos && safePos < end) {
      return i;
    }
    blockPos = end;
  }

  return doc.childCount - 1;
}

function resolveLockedBlockRange(
  doc: import("@tiptap/pm/model").Node,
  lockedBlockId: string | null,
  lockedBlockIndex: number | null,
  lockedSelectionFrom: number | null,
): { from: number; to: number } | null {
  if (lockedSelectionFrom != null && lockedSelectionFrom >= 1) {
    const bySelection = findBlockIndexAtPosition(doc, lockedSelectionFrom);
    if (bySelection != null) {
      const range = findBlockRangeByIndex(doc, bySelection);
      if (range) return range;
    }
  }

  if (lockedBlockId) {
    const byId = findBlockRangeById(doc, lockedBlockId);
    if (byId) return byId;
  }

  if (lockedBlockIndex != null) {
    return findBlockRangeByIndex(doc, lockedBlockIndex);
  }

  return null;
}

function buildCollaborationDecorations(
  doc: import("@tiptap/pm/model").Node,
  collaboration: RemoteCollaborationMeta,
): DecorationSet {
  const decorations: Decoration[] = [];
  const range = resolveLockedBlockRange(
    doc,
    collaboration.lockedBlockId,
    collaboration.lockedBlockIndex,
    collaboration.lockedSelectionFrom,
  );

  if (range) {
    decorations.push(
      Decoration.node(range.from, range.to, {
        class: "editor-block--remote-lock",
        "data-remote-editor": collaboration.lockedByName
          ? `${collaboration.lockedByName} is editing`
          : "A collaborator is editing",
      }),
    );
  }

  decorations.push(...buildRemoteCursorDecorations(doc, collaboration.remoteCursors));

  if (decorations.length === 0) {
    return DecorationSet.empty;
  }

  return DecorationSet.create(doc, decorations);
}

function isCollaborationMeta(value: unknown): value is RemoteCollaborationMeta {
  return Boolean(value && typeof value === "object" && "remoteCursors" in value);
}

export const RemoteBlockLock = Extension.create({
  name: "remoteBlockLock",

  addProseMirrorPlugins() {
    return [
      new Plugin<RemoteCollaborationPluginState>({
        key: remoteCollaborationKey,
        state: {
          init: (_, state) => {
            const collaboration = emptyCollaboration();
            return {
              collaboration,
              decorations: buildCollaborationDecorations(state.doc, collaboration),
            };
          },
          apply(tr, pluginState, _oldState, newState) {
            const meta = tr.getMeta(remoteCollaborationKey);
            const collaboration = isCollaborationMeta(meta)
              ? meta
              : pluginState.collaboration;

            const shouldRefresh =
              Boolean(meta) ||
              tr.docChanged ||
              tr.selectionSet;

            const decorations = shouldRefresh
              ? buildCollaborationDecorations(newState.doc, collaboration)
              : pluginState.decorations.map(tr.mapping, tr.doc);

            return { collaboration, decorations };
          },
        },
        props: {
          decorations(state) {
            return remoteCollaborationKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
