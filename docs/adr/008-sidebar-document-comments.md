# ADR 008 — Sidebar Document Comments

**Status:** accepted  
**Date:** July 2026

## Context

Phase 05b implemented document comments with **block gutter bubbles** ported from the ui-mock prototype. The ui-mock renders each block as a React component with an inline comment rail. TipTap renders a single ProseMirror document; binding overlay markers to blocks required fragile DOM index mapping (`root.children[i]` ↔ PM child `i`, `nodeDOM`, portals). Markers repeatedly appeared on the wrong block or at the document end.

Product requirements remain:

- Add a comment on selected text (bubble menu)
- Persist comments in `documents.metadata.comments`
- Highlight commented text in the document
- Review comments without losing writing focus

## Decision

Adopt a **sidebar-first comment model** (Google Docs / Notion pattern):

| Surface | Role |
|---------|------|
| **Highlighted text** in the editor | Indicates a comment exists; click opens sidebar |
| **Comments (N)** in document header | Opens right panel Comments tab |
| **Comments tab** in right panel | List of comment cards; hover/click syncs highlight + scroll |

Remove block gutter / overlay comment markers entirely.

### Interaction rules

1. **Add** — User selects text → bubble menu Comment → highlight applied; header shows `Comments (N)` when N > 0.
2. **Read (document)** — Click highlighted span → open panel → Comments tab → select card.
3. **Read (panel)** — Click header link or panel tab → comment list; hover card = temporary highlight; click card = selected highlight + scroll into view if needed.
4. **Scroll** — Use the editor canvas scroll container (`editor-view__canvas`), not `window`.
5. **Template mode** — No comments UI (unchanged).

### Data model (unchanged)

`StoredDocumentComment`: `{ id, blockId, blockIndex, from, to, anchorText, text, author, createdAt }` in `metadata.comments`. ProseMirror `commentHighlight` mark stores `commentId`. Positions remap on edit via `syncCommentsWithDocument`.

## Alternatives considered

| Option | Rejected because |
|--------|------------------|
| Fix block overlay mapping | Fighting TipTap DOM; recurring off-by-block bugs |
| Per-block NodeViews for rails | High complexity; custom node wrapper for every block type |
| Dedicated comments column in editor grid | Reserves horizontal space; sidebar already exists |
| Modal-only comments | Hides context; poor for reviewing many comments |

## Consequences

**Positive:**

- Reliable UX — no block↔DOM coupling for markers
- Scales to many comments
- Reuses existing right panel, `CommentNoteBubble`, highlight marks
- Matches user mental model from other document tools

**Negative:**

- No at-a-glance per-block marker in the margin (mitigated by highlights)
- Extra click to read vs inline bubble (acceptable for review workflow)

## Dependencies

- [ADR 003 — TipTap Editor](003-tiptap-editor.md)
- [ADR 006 — Editor-First On-Demand Chrome](006-editor-first-on-demand-chrome.md)
- [05d-sidebar-comments.md](../../implementation_plan/05d-sidebar-comments.md)
- [11-editor-tiptap.md](../11-editor-tiptap.md)
