# Phase 05d — Sidebar Document Comments

**Status:** in progress (core sidebar UX implemented)  
**Depends on:** Phase 05b (comment marks + persistence)  
**Supersedes:** Comment overlay / block gutter markers from 05b  

---

## Objectives

1. Replace fragile **block gutter comment bubbles** with a **sidebar comment panel**.
2. Add **Comments (N)** header link between “Save as template” and “Properties”.
3. Add **Comments** tab to the right panel with comment cards.
4. **Bidirectional linking:** panel ↔ highlighted text (hover, click, scroll-into-view).
5. Remove `EditorCommentsOverlay` and related block-marker positioning code.

See [ADR 008 — Sidebar Document Comments](../docs/adr/008-sidebar-document-comments.md).

---

## UX specification

### Entry points

| Action | Result |
|--------|--------|
| Bubble menu → Comment on selection | Highlight + persist; header shows `Comments (N)` |
| Click highlighted text | Open panel → Comments tab → select card |
| Click `Comments (N)` in header | Open panel → Comments tab |
| Hover comment card | Emphasize matching highlight in document |
| Click comment card | Select card + emphasize + scroll to highlight if out of viewport |

### Visibility

- Header link: visible when `comments.length > 0` and not template mode
- Comments tab: always in panel tab bar on editor view
- Template mode: no comment UI

---

## File checklist

```
apps/web/src/
├── lib/documents/
│   └── comment-navigation.ts      # scrollCommentIntoView
├── components/
│   ├── CommentsTab.tsx
│   ├── CommentsTab.css
│   └── RightPanel.tsx             # + Comments tab
├── context/AppContext.tsx         # PanelTab += "comments"
├── views/EditorView.tsx           # header link, comment bridge props
└── components/editor/
    ├── TipTapEditor.tsx           # click highlights; remove overlay
    └── extensions/CommentHighlight.ts  # pointer cursor (CSS)

docs/adr/008-sidebar-document-comments.md
```

**Remove:**

- `components/editor/EditorCommentsOverlay.tsx`
- `components/editor/EditorCommentsOverlay.css`

---

## Tasks

| Task | Status |
|------|--------|
| ADR 008 | done |
| Phase plan 05d | done |
| `scrollCommentIntoView` helper | done |
| `PanelTab` += `comments` | done |
| `CommentsTab` component | done |
| Header `Comments (N)` link | done |
| Highlight click → open panel | done |
| Panel hover/click → highlight + scroll | done |
| Remove `EditorCommentsOverlay` | done |
| Comment decorations survive save/reload | todo |

---

## Technical notes

### Scroll

```typescript
const coords = editor.view.coordsAtPos(comment.from);
// scroll editor-view__canvas so coords.top is within viewport + offset
```

### Highlight click

`editorProps.handleClick` → `closest('[data-comment-id]')` → `onCommentHighlightClick(id)`.

### Emphasis

`hoverCommentId ?? selectedCommentId` drives `.editor-comment-highlight--emphasized` class toggling (existing TipTap effect).

### Panel state

`selectedCommentId` and `hoverCommentId` live in `EditorView`; passed to `TipTapEditor` and `RightPanel`.

---

## Out of scope (Phase 08)

- Multi-user threads, @mentions, resolve status
- `document_comments` table + RLS
- Email notifications on comment

---

## Exit criteria

1. User adds comment on selection; highlight visible; no block gutter bubble.
2. Header shows `Comments (N)`; click opens Comments tab.
3. Click highlight opens panel and selects comment.
4. Hover/click card in panel emphasizes highlight; scrolls if needed.
5. Comments persist across reload via metadata.
