# Phase 05b — Block Drag-and-Drop & Comment Overlay

**Status:** mostly complete (comment mark reload polish remaining)  
**Depends on:** Phase 05 core editor  

---

## Objectives

1. Port **block drag-and-drop** from ui-mock to TipTap editor (grip on hover, drop indicator, reorder top-level blocks).
2. Port **comment overlay UX** — markers float beside content (no reserved 260px gutter); thread panel opens on marker click.
3. Wire bubble menu **Comment** action to add inline notes on text selection.
4. Persist comments in `documents.metadata.comments` until dedicated `document_comments` table ships in Phase 08.

---

## UI reference

- `ui-mock/src/components/EditorBody.tsx` — drag + comment rail (adapt rail to overlay)
- `ui-mock/src/components/BlockDragHandle.tsx`, `BlockDropZone.tsx`
- `apps/web/src/components/CommentMarker.tsx`, `CommentPopover.tsx`, `CommentNoteBubble.tsx`

---

## File checklist

```
apps/web/src/
├── lib/documents/
│   ├── block-drag.ts              # moveTopLevelBlock, computeDropIndex
│   └── comments.ts                # StoredDocumentComment parse/save helpers
├── components/editor/
│   ├── EditorBlockDragLayer.tsx
│   ├── EditorBlockDragLayer.css
│   ├── EditorCommentsOverlay.tsx
│   ├── EditorCommentsOverlay.css
│   └── extensions/CommentHighlight.ts
└── views/EditorView.tsx           # pass comments props
```

---

## Tasks

| Task | Status |
|------|--------|
| Block drag handle on row hover | done |
| Drop zone between blocks | done |
| `moveTopLevelBlock` via ProseMirror transaction | done |
| Comment mark on selection + popover from bubble | done |
| Overlay comment markers (fixed position, scroll sync) | done |
| Comment thread panel on marker click | done |
| Persist comments in `metadata.comments` | done |
| Comment decorations survive save/reload | todo |

---

## Out of scope (Phase 08)

- Multi-user comment threads, @mentions, resolve status
- `document_comments` table + RLS
- Email notifications on comment

---

## Exit criteria

1. User can reorder paragraphs, headings, tables, images via drag handle.
2. User can add a comment on selected text from bubble menu.
3. Comment markers appear as overlay chips; clicking opens thread.
4. Comments persist across reload via document metadata.
