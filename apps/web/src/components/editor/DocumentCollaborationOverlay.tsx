"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import type { RemoteCollaboratorCursor } from "@/components/editor/extensions/remote-cursor-decorations";
import { resolveRemoteCursorAnchor } from "@/components/editor/extensions/remote-cursor-decorations";
import {
  avatarBackgroundStyle,
  avatarHueForUser,
  initialsFromName,
  resolveAvatarPublicUrl,
} from "@/lib/profile/avatar";
import {
  getBlockElementAtIndex,
  getTopLevelBlockElements,
  getTopLevelBlockIndexFromPos,
} from "@/lib/documents/block-drag";
import "./DocumentCollaborationOverlay.css";

type CursorLayout = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  top: number;
  left: number;
  color: string;
};

type DocumentCollaborationOverlayProps = {
  editor: Editor;
  surfaceRef: React.RefObject<HTMLElement | null>;
  remoteCursors: RemoteCollaboratorCursor[];
  lockedBlockIndex: number | null;
  lockedSelectionFrom: number | null;
  lockedByName: string | null;
};

function computeCursorLayouts(
  editor: Editor,
  surface: HTMLElement,
  remoteCursors: RemoteCollaboratorCursor[],
): CursorLayout[] {
  const surfaceRect = surface.getBoundingClientRect();
  const layouts: CursorLayout[] = [];

  for (const cursor of remoteCursors) {
    const anchor = resolveRemoteCursorAnchor(editor.state.doc, cursor);
    if (!anchor) continue;

    try {
      const coords = editor.view.coordsAtPos(anchor.from);
      layouts.push({
        userId: cursor.userId,
        displayName: cursor.displayName,
        avatarUrl: cursor.avatarUrl,
        top: coords.top - surfaceRect.top,
        left: coords.left - surfaceRect.left,
        color: `hsl(${avatarHueForUser(cursor.userId)} 62% 46%)`,
      });
    } catch {
      // Position may be invalid while the document is syncing.
    }
  }

  return layouts;
}

function resolveLockedBlockElement(
  editor: Editor,
  lockedSelectionFrom: number | null,
  lockedBlockIndex: number | null,
): HTMLElement | null {
  if (lockedSelectionFrom != null && lockedSelectionFrom >= 1) {
    const index = getTopLevelBlockIndexFromPos(editor, lockedSelectionFrom);
    if (index != null) {
      const byIndex = getBlockElementAtIndex(editor, index);
      if (byIndex) return byIndex;
    }
  }

  if (lockedBlockIndex != null) {
    return getBlockElementAtIndex(editor, lockedBlockIndex);
  }

  return null;
}

export function DocumentCollaborationOverlay({
  editor,
  surfaceRef,
  remoteCursors,
  lockedBlockIndex,
  lockedSelectionFrom,
  lockedByName,
}: DocumentCollaborationOverlayProps) {
  const [cursorLayouts, setCursorLayouts] = useState<CursorLayout[]>([]);

  useEffect(() => {
    const applyBlockLock = () => {
      const lockedBlock = resolveLockedBlockElement(
        editor,
        lockedSelectionFrom,
        lockedBlockIndex,
      );

      for (const block of getTopLevelBlockElements(editor)) {
        const locked = lockedBlock != null && block === lockedBlock;
        block.classList.toggle("editor-block--remote-lock", locked);
        if (locked && lockedByName) {
          block.setAttribute("data-remote-editor", `${lockedByName} is editing`);
        } else {
          block.removeAttribute("data-remote-editor");
        }
      }
    };

    applyBlockLock();
    editor.on("update", applyBlockLock);

    return () => {
      editor.off("update", applyBlockLock);
      getTopLevelBlockElements(editor).forEach((block) => {
        block.classList.remove("editor-block--remote-lock");
        block.removeAttribute("data-remote-editor");
      });
    };
  }, [editor, lockedBlockIndex, lockedSelectionFrom, lockedByName]);

  useEffect(() => {
    const updateCursors = () => {
      const surface = surfaceRef.current;
      if (!surface) {
        setCursorLayouts([]);
        return;
      }
      setCursorLayouts(computeCursorLayouts(editor, surface, remoteCursors));
    };

    updateCursors();
    editor.on("update", updateCursors);
    editor.on("selectionUpdate", updateCursors);
    window.addEventListener("scroll", updateCursors, true);
    window.addEventListener("resize", updateCursors);

    return () => {
      editor.off("update", updateCursors);
      editor.off("selectionUpdate", updateCursors);
      window.removeEventListener("scroll", updateCursors, true);
      window.removeEventListener("resize", updateCursors);
    };
  }, [editor, remoteCursors, surfaceRef]);

  const showOverlay =
    cursorLayouts.length > 0 ||
    lockedSelectionFrom != null ||
    lockedBlockIndex != null;

  if (!showOverlay) {
    return null;
  }

  return (
    <div className="document-collaboration-overlay" aria-hidden="true">
      {cursorLayouts.map((cursor) => {
        const imageUrl = resolveAvatarPublicUrl(cursor.avatarUrl);
        const avatarStyle = avatarBackgroundStyle(cursor.userId);

        return (
          <div
            key={cursor.userId}
            className="remote-collaborator-cursor remote-collaborator-cursor--overlay"
            style={{
              top: cursor.top,
              left: cursor.left,
              ["--remote-cursor-color" as string]: cursor.color,
            }}
          >
            <span className="remote-collaborator-cursor__caret" />
            <span className="remote-collaborator-cursor__flag">
              <span className="remote-collaborator-cursor__avatar">
                {imageUrl ? (
                  <img src={imageUrl} alt="" />
                ) : (
                  <span
                    className="remote-collaborator-cursor__initials"
                    style={avatarStyle}
                  >
                    {initialsFromName(cursor.displayName)}
                  </span>
                )}
              </span>
              <span className="remote-collaborator-cursor__label">
                {cursor.displayName}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
