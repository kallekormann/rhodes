# 02 — Information Architecture

**Status:** draft

## Context

Rhodes must scale to many documents, sources, and future filtered views — without resorting to a permanent SaaS sidebar or dashboard navigation.

## Decision

**Flat, contextual model** with orthogonal navigation: the user always lands in the Editor; Spaces, Library, Templates, and Views are accessed on demand via header controls or Cmd+K.

## Specification

### Top-level structure

```
App Root (100vh, viewport-locked)
│
├── Header (orientation anchors — slim, auto-hide on write)
│   ├── Space Switcher (Private ↔ Team)
│   ├── Document title
│   ├── Scope hint (Documents / Library when in Library mode)
│   ├── Search, New, Info
│   └── Profile, theme toggle
│
├── Main Canvas (default: Editor)
│   └── Centered writing area (max 720px)
│
└── Right Panel (on-demand only)
    ├── Insights (semantic matches)
    └── Tools / Metadata (tags, fields, history)
```

### Logical areas (not separate apps)

| Area | Purpose | Default access |
|------|---------|----------------|
| **Space** | Data isolation boundary (Private or Team) | Header dropdown |
| **Documents** | Active writing, editable content | Default canvas |
| **Library** | Passive sources (PDFs, imports) | Scope switcher or drag-drop |
| **Templates** | Document structure presets | Transient page on "New from template" |
| **Views** | Saved metadata filters (V1.5) | Search overlay + Cmd+K |
| **Insights** | AI-retrieved context | Right panel, contextual |

### Space model

- **Personal Space** — private to one user; default `Private` at signup; user may create more (book, research, side projects) with full isolation per space
- **Team Space** — created for a project/team; shared knowledge pool; roles: Owner, Admin, Member
- All data scoped by `workspace_id`; AI queries always bound to **one** active space

### Documents vs Library

| | Documents | Library |
|---|-----------|---------|
| Nature | Active, editable | Passive, reference |
| Content | TipTap JSON | Extracted plain text + chunks |
| Embedding | Whole-doc + plain text | Per-chunk |
| User action | Write, edit, cite | Import, browse, search |

### Navigation principles

1. **No left sidebar file tree** — search and recent replace folder hierarchy
2. **No dashboard home screen** — open last edited document on launch
3. **Scope is always visible** in header (Space name + context)
4. **Views scale IA** without new nav chrome — filters appear in search results

### Scalability path

| Phase | Capability |
|-------|------------|
| V1 | Space switcher + semantic search + recent in template page |
| V1.5 | Saved Views (filter by metadata) via search/Cmd+K |
| V2 | Graph/backlink explorer (optional overlay, not permanent nav) |

## Open questions

- Should Library have a dedicated full-screen browse mode or always overlay?
- Max Team Spaces per org on Free tier?

## Dependencies

- [03-ux-ui-design.md](03-ux-ui-design.md)
- [07-individual-vs-team.md](07-individual-vs-team.md)
- [10-templates-and-views.md](10-templates-and-views.md)
