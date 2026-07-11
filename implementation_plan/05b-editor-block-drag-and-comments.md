# Phase 05b — Block Drag-and-Drop & Comment Foundation

**Status:** complete (block drag + comment marks; overlay superseded by 05d)  
**Depends on:** Phase 05 core editor  

---

## Objectives

1. Port **block drag-and-drop** from ui-mock to TipTap editor (grip on hover, drop indicator, reorder top-level blocks).
2. ~~Port **comment overlay UX**~~ → moved to **sidebar comments** ([05d](05d-sidebar-comments.md), [ADR 008](../docs/adr/008-sidebar-document-comments.md)).
3. Wire bubble menu **Comment** action to add inline notes on text selection.
4. Persist comments in `documents.metadata.comments` until dedicated `document_comments` table ships in Phase 08.

---

## UI reference

- `ui-mock/src/components/EditorBody.tsx` — drag handles + drop zones
- `ui-mock/src/components/BlockDragHandle.tsx`, `BlockDropZone.tsx`
- `apps/web/src/components/CommentNoteBubble.tsx` — reused in sidebar (05d)

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
| Persist comments in `metadata.comments` | done |
| ~~Overlay comment markers~~ | superseded → [05d](05d-sidebar-comments.md) |
| Comment decorations survive save/reload | → [05d](05d-sidebar-comments.md) |

---

## Out of scope (Phase 08)

- Multi-user comment threads, @mentions, resolve status
- `document_comments` table + RLS
- Email notifications on comment

---

## Exit criteria

1. User can reorder paragraphs, headings, tables, images via drag handle.
2. User can add a comment on selected text from bubble menu.
3. Comments persist across reload via document metadata.
4. Sidebar comment UX → see [05d exit criteria](05d-sidebar-comments.md).
