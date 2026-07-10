# 11 — Editor (TipTap)

**Status:** draft

## Context

The editor is Rhodes' primary surface. It must be minimal for focus yet capable for structured content, citations, and templates.

## Decision

Use **TipTap** (ProseMirror) headless with a curated extension set and custom Citation block. No permanent formatting toolbar — bubble menu on selection only.

## Specification

### Why TipTap

| Criterion | TipTap |
|-----------|--------|
| Headless / customizable | Yes |
| Slash commands | Native extension |
| JSON document model | Fits DB `content jsonb` |
| React integration | `@tiptap/react` |
| Tables, images | Extensions available |

Alternatives considered: Lexical (heavier ecosystem shift), BlockNote (opinionated blocks), Plate (shadcn-coupled). TipTap matches PRD and team familiarity.

### V1 extensions

| Extension | Purpose |
|-----------|---------|
| StarterKit | Paragraphs, headings, bold, italic, lists |
| Placeholder | "Start writing…" empty state |
| Typography | Smart quotes, dashes |
| Table | Native HTML tables via `/table` |
| Image | Drag-drop upload to Supabase Storage |
| Link | Inline links |
| Blockquote | Quotes from insight sidebar |
| CharacterCount | Optional footer meta |
| SlashCommands | `/` menu |

### Custom extensions

**CitationBlock** — inserted by insight quote feature:
```json
{
  "type": "citation",
  "attrs": {
    "sourceId": "uuid",
    "sourceTitle": "Reforge Growth.pdf",
    "page": 12,
    "backlink": "[[Reforge Growth#p12]]"
  }
}
```

**SectionHeading** — template sections with `data-section-id` for template injection.

### UX rules

| Rule | Implementation |
|------|----------------|
| No permanent toolbar | Bubble menu on text selection only: B, I, Link, Quote |
| Slash for power features | `/heading`, `/table`, `/image`, `/divider` |
| Zen mode | Hide header when typing; editor full focus |
| Max width | 720px centered |
| Font size | 18–20px body (see 03a-design-language) |

### Image upload

1. Drag image onto editor
2. Upload to `supabase storage: {workspace_id}/images/{uuid}`
3. Insert TipTap image node with signed URL

### Local-first

- TipTap state mirrored to IndexedDB on `onUpdate` (debounced 500ms)
- Sync to server debounced 2000ms when online

### Accessibility

- Heading hierarchy enforced (no skipping levels in templates)
- Keyboard: Cmd+B/I, Cmd+K for link
- Screen reader: aria labels on bubble menu

## Open questions

- Markdown export/import round-trip?
- Vim mode (Obsidian users expect it)?

## Dependencies

- [03-ux-ui-design.md](03-ux-ui-design.md)
- [10-templates-and-views.md](10-templates-and-views.md)
- [12-offline-sync.md](12-offline-sync.md)
- [adr/003-tiptap-editor.md](adr/003-tiptap-editor.md)
