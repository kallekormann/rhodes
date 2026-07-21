import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  avatarBackgroundStyle,
  avatarHueForUser,
  initialsFromName,
  resolveAvatarPublicUrl,
} from "@/lib/profile/avatar";
import { readBlockId } from "@/lib/documents/block-ids";

export type RemoteCollaboratorCursor = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  from: number;
  to: number;
  blockId?: string | null;
  blockIndex?: number | null;
};

function clampPosition(pos: number, docSize: number): number {
  return Math.max(1, Math.min(pos, docSize));
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

function findBlockRange(
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

export function resolveRemoteCursorAnchor(
  doc: import("@tiptap/pm/model").Node,
  cursor: RemoteCollaboratorCursor,
): { from: number; to: number } | null {
  const docSize = doc.content.size;
  if (docSize <= 0) return null;

  const hasSelection =
    Number.isFinite(cursor.from) &&
    cursor.from >= 1 &&
    cursor.from <= docSize;

  if (hasSelection) {
    const from = clampPosition(cursor.from, docSize);
    const to = clampPosition(
      Number.isFinite(cursor.to) && cursor.to >= from ? cursor.to : from,
      docSize,
    );
    return { from, to };
  }

  if (cursor.blockId) {
    const range = findBlockRange(doc, cursor.blockId);
    if (range) {
      const anchor = Math.min(range.from + 1, docSize);
      return { from: anchor, to: anchor };
    }
  }

  if (cursor.blockIndex != null) {
    const range = findBlockRangeByIndex(doc, cursor.blockIndex);
    if (range) {
      const anchor = Math.min(range.from + 1, docSize);
      return { from: anchor, to: anchor };
    }
  }

  return null;
}

function createCursorElement(cursor: RemoteCollaboratorCursor): HTMLElement {
  const hue = avatarHueForUser(cursor.userId);
  const color = `hsl(${hue} 62% 46%)`;

  const root = document.createElement("span");
  root.className = "remote-collaborator-cursor";
  root.setAttribute("data-user-id", cursor.userId);
  root.style.setProperty("--remote-cursor-color", color);

  const caret = document.createElement("span");
  caret.className = "remote-collaborator-cursor__caret";
  caret.setAttribute("aria-hidden", "true");

  const flag = document.createElement("span");
  flag.className = "remote-collaborator-cursor__flag";

  const avatar = document.createElement("span");
  avatar.className = "remote-collaborator-cursor__avatar";
  const imageUrl = resolveAvatarPublicUrl(cursor.avatarUrl);
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "";
    avatar.appendChild(img);
  } else {
    const initials = document.createElement("span");
    initials.className = "remote-collaborator-cursor__initials";
    initials.textContent = initialsFromName(cursor.displayName);
    Object.assign(avatar.style, avatarBackgroundStyle(cursor.userId));
    avatar.appendChild(initials);
  }

  const label = document.createElement("span");
  label.className = "remote-collaborator-cursor__label";
  label.textContent = cursor.displayName;

  flag.appendChild(avatar);
  flag.appendChild(label);
  root.appendChild(caret);
  root.appendChild(flag);

  return root;
}

export function buildRemoteCursorDecorations(
  doc: import("@tiptap/pm/model").Node,
  cursors: RemoteCollaboratorCursor[],
): Decoration[] {
  const decorations: Decoration[] = [];

  for (const cursor of cursors) {
    const anchor = resolveRemoteCursorAnchor(doc, cursor);
    if (!anchor) continue;

    const { from, to } = anchor;
    const hue = avatarHueForUser(cursor.userId);

    if (from < to) {
      decorations.push(
        Decoration.inline(from, to, {
          class: "remote-collaborator-selection",
          style: `background-color: hsl(${hue} 62% 46% / 0.18)`,
        }),
      );
    }

    decorations.push(
      Decoration.widget(
        from,
        () => createCursorElement({ ...cursor, from, to }),
        {
          side: 1,
          key: `remote-cursor-${cursor.userId}`,
        },
      ),
    );
  }

  return decorations;
}

export function createRemoteCursorDecorationSet(
  doc: import("@tiptap/pm/model").Node,
  cursors: RemoteCollaboratorCursor[],
): DecorationSet {
  if (!cursors.length) return DecorationSet.empty;
  return DecorationSet.create(doc, buildRemoteCursorDecorations(doc, cursors));
}
