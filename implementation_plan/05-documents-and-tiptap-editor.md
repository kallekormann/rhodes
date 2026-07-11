# Phase 05 — Documents and TipTap Editor

**Status:** complete  
**Depends on:** Phase 04  
**Blocks:** Phase 06, Phase 09  
**Estimated duration:** 7–10 days

---

## Objectives

1. Implement **document CRUD** API scoped to active workspace.
2. Replace mock `EditorBody` with **TipTap** editor per spec.
3. Port editor UX: bubble menu, slash menu, link popover, 3-column grid, header auto-hide.
4. Build **Documents view** with templates strip, recent/all/favorites.
5. Auto-open **last edited document** on login.

---

## Prerequisites

- Phase 04 exit criteria met (app shell, components, scope switcher).
- Authenticated user with workspace.

---

## Canonical spec references

- [11-editor-tiptap.md](../docs/11-editor-tiptap.md)
- [26-ui-mock-reference.md](../docs/26-ui-mock-reference.md) — editor UX contracts
- [03-ux-ui-design.md](../docs/03-ux-ui-design.md) — States A, D, D2
- [10-templates-and-views.md](../docs/10-templates-and-views.md)
- [04-data-model.md](../docs/04-data-model.md) — documents table
- [adr/003-tiptap-editor.md](../docs/adr/003-tiptap-editor.md)

---

## Docker services touched

| Service | Usage |
|---------|-------|
| `supabase-kong` | Document CRUD via PostgREST / API routes |
| `supabase-storage` | Image uploads (Phase 05 basic) |

---

## File checklist

```
apps/web/src/
├── app/api/documents/
│   ├── route.ts                    # GET list, POST create
│   └── [id]/route.ts               # GET, PATCH, DELETE
├── components/editor/
│   ├── TipTapEditor.tsx
│   ├── extensions/
│   │   ├── CitationBlock.ts
│   │   └── SlashCommands.ts
│   ├── BubbleMenu.tsx
│   ├── LinkPopover.tsx
│   ├── SlashMenu.tsx
│   └── EditorToolbar.tsx           # None permanent — bubble only
├── views/
│   ├── EditorView.tsx              # Wire TipTapEditor
│   └── DocumentsView.tsx           # Real data
├── hooks/
│   ├── useDocument.ts
│   ├── useDocuments.ts
│   └── useLastDocument.ts
└── lib/documents/
    ├── save.ts                     # Debounced save
    └── plain-text.ts               # Extract content_plain from TipTap JSON
```

---

## TipTap dependencies

```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-placeholder": "^2.x",
  "@tiptap/extension-typography": "^2.x",
  "@tiptap/extension-table": "^2.x",
  "@tiptap/extension-image": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "@tiptap/extension-blockquote": "^2.x",
  "@tiptap/extension-character-count": "^2.x"
}
```

---

## Step-by-step tasks

### 1. Document API routes

**`POST /api/documents`:**
```typescript
// Body: { workspace_id, title?, template_id? }
// If template_id: copy structure_json into content
// Returns: { id, title, content, ... }
```

**`GET /api/documents?workspace_id=&filter=recent|all|favorites`:**
- RLS enforces membership
- `recent`: order by `updated_at desc`, limit 50
- `favorites`: `metadata->>'favorite' = 'true'`

**`PATCH /api/documents/[id]`:**
```typescript
// Body: { title?, content?, content_plain?, metadata? }
// Update updated_at
```

**`DELETE /api/documents/[id]`:** Soft-delete (add `deleted_at` column) or hard delete per open decision.

### 2. TipTap editor component

**`TipTapEditor.tsx`:**
- Initialize from `document.content` JSONB
- Extensions per [11-editor-tiptap.md](../docs/11-editor-tiptap.md)
- `editorProps`: `class: 'editor-body'`
- Debounced `onUpdate` → save (500ms)

### 3. Custom CitationBlock extension

```typescript
// Node spec from 11-editor-tiptap.md
// attrs: sourceId, sourceTitle, page, excerpt
// Render: blockquote with backlink chip
```

Used in Phase 07 quote flow; implement structure now.

### 4. Slash commands

Port logic from `ui-mock/src/components/editorSlash.ts`:
- `/` triggers `SlashMenu`
- Items: Paragraph, Heading 2, Divider, Table, Image, Blockquote
- Table → `TableInsertModal` (port from mock)
- Filter as user types

### 5. Bubble menu

Port `BubbleMenu.tsx` from mock:
- On text selection: Bold, Italic, Lists, Link, Comment (stub), **Ask** (stub → Phase 07)
- Position above/below selection using float chrome tokens
- `LinkPopover` for URL + internal doc search (internal search uses document list API)

### 6. Editor layout

CSS from mock `EditorBody.css` + `EditorView.css`:
- `--editor-gutter-left`, `--editor-gutter-right`, `--editor-grid-gap`
- 720px text column
- Left gutter: `BlockDragHandle` (defer drag-drop to Phase 05b or 08 if time-constrained)
- Right gutter: comment markers (stub until comment system)

### 7. Header auto-hide

Port scroll behavior from mock:
- Hide header after 2s continuous typing / scroll down
- Reveal zone at top 48px on mouse move

### 8. Documents view

Wire `DocumentsView.tsx`:
- Templates strip from `templates` table (`is_system = true`)
- Tabs: Recent / All / Favorites (`SegmentedControl`)
- Search filters by title (`Input` with icon)
- `ListRow` click → navigate `/editor?doc={id}`
- "New" button in header → blank document

### 9. Last document resume

Store `last_document_id` per workspace in localStorage:
```typescript
// On document open: localStorage.setItem(`rhodes:last_doc:${workspaceId}`, docId)
// On /editor load: fetch last doc or create blank
```

Matches [03-ux-ui-design.md](../docs/03-ux-ui-design.md) zero-click resume.

### 10. content_plain extraction

On save, walk TipTap JSON tree → plain text string for search/embed (Phase 07):
```typescript
function extractPlainText(json: JSONContent): string { ... }
```

### 12. Document lifecycle: archive, share, delete

**Documents list row actions (hover):**
- Share → opens editor (share popover under scope meta)
- Archive / restore → `metadata.archived`
- Delete → hard delete via `DELETE /api/documents/[id]`

**Documents tabs:** Recent / All / Favorites / **Archive** / **Shared**

**Archive filter:** `metadata.archived = true`  
**Shared filter:** documents with `document_shares` rows (outgoing in workspace + incoming grants)

**Editor share popover:**
- Click scope meta (`Personal · Private`) under title
- Search people and team spaces via `GET /api/share-targets`
- Persist grants in `document_shares` table

### 13. `document_shares` table

```sql
document_shares (
  document_id, shared_by,
  grantee_type user|workspace,
  grantee_user_id | grantee_workspace_id,
  label
)
```

RLS: workspace members manage shares; grantees gain document read via extended documents SELECT policy.

---

## Remaining tasks (Phase 05)

| Task | Status |
|------|--------|
| Document CRUD API | done |
| Workspace bootstrap + RLS fixes | done |
| Documents view wired to real data | done |
| Last document resume | done |
| Header **+** and Cmd+K **New document** | done |
| Favorites via `metadata.favorite` | done |
| TipTap replaces plain input | done |
| Bubble menu (ui-mock chrome) | done |
| Slash menu (`/paragraph`, `/table`, `/image`, etc.) | done |
| Tables via slash + insert modal | done |
| Image upload (storage bucket + drag/drop) | done (basic) |
| CitationBlock extension structure | done |
| Archive tab + row action | done |
| Shared tab + share popover | done |
| Delete row action | done |
| Slash menu positioning + keyboard/mouse selection | done (polish ongoing) |
| Bubble menu viewport clamping (flip/shift) | done |
| Link popover internal search → real documents API | done |
| Template strip from DB (`is_system`) | done |
| Create template flow (draft in editor → publish) | done |
| Save existing document as template | done |
| Documents: delete confirmation dialog (not browser) | done |
| Documents: share popover inline (not open editor) | done |
| Documents: unarchive control on archived rows | done |
| Templates view layout matches documents width | done |
| Template edit flow (`?template=` + Edit button) | done |
| Delete owned templates from sidebar | done |
| Hide template drafts from documents list | done |
| Block drag-and-drop + comment overlay | **→ [05b](05b-editor-block-drag-and-comments.md)** done |
| Metadata, properties, template fields, Created at, signed URLs | **→ [05c](05c-metadata-properties-and-polish.md)** done |
| Sidebar comments | **→ [05d](05d-sidebar-comments.md)** done |

**Sub-phases:** [05b](05b-editor-block-drag-and-comments.md) · [05c](05c-metadata-properties-and-polish.md)

---

## Testing checklist

- [x] Create blank document → opens in editor
- [x] Title editable inline in meta row
- [x] TipTap: bold, italic, headings, lists work
- [x] Slash menu inserts blocks
- [x] Bubble menu on selection
- [x] Link popover: external URL + internal doc link
- [x] Table insert via slash menu
- [x] Image drag-drop uploads and renders
- [x] Auto-save: edit → reload → content persisted
- [x] `content_plain` updated on save
- [x] Documents view: recent list, search, favorites toggle
- [x] Login → last edited document opens automatically
- [x] Document isolated to workspace (RLS)
- [x] Template selection creates structured document (no duplicate title in body)
- [x] Create template: draft in editor → Publish template
- [x] Save existing document as template from editor
- [x] Documents: delete uses in-app dialog
- [x] Documents: share button shows popover on list row
- [x] Documents: unarchive from archived list
- [x] Templates view layout matches documents width
- [x] Header auto-hide during typing
- [x] Archive / restore document
- [ ] Share with person or team → appears in Shared tab *(blocked: no team members on dev; needs Phase 08 teams)*
- [x] Block drag-and-drop reorder (no phantom blocks at top)
- [x] Properties tab: schema-driven text / select / date fields
- [x] Template description + use cases editable (`?template=`)
- [x] New document from template inherits default property values
- [x] Signed URL refresh on document/template load
- [x] Sidebar comments: add, reply, remove, panel ↔ highlight linking
- [x] Comments persist across reload via metadata

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Signed URL generation (server route only) |

---

## Exit criteria

1. Full document CRUD works per workspace.
2. TipTap editor replaces mock EditorBody with all V1 extensions.
3. Bubble menu + slash menu functional.
4. Documents view wired to real data.
5. Last document auto-opens on login.
6. Editor layout matches ui-mock (720px, gutters, header behavior).

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| TipTap SSR hydration mismatch | Dynamic import with `ssr: false` for editor |
| Large document performance | Debounce saves; avoid re-render on every keystroke |
| Comment/drag scope creep | Stub comments; defer drag-drop if schedule tight |
| JSONB schema drift | Validate with Zod on API boundary |

---

## Optional sub-phases

- **[05b — Block drag & comment foundation](05b-editor-block-drag-and-comments.md)** — done
- **[05d — Sidebar comments](05d-sidebar-comments.md)** — done
- **[05c — Metadata, properties & polish](05c-metadata-properties-and-polish.md)** — done

---

## Deliverables

- Document API (CRUD)
- TipTapEditor + extensions
- Bubble menu, slash menu, link popover
- Documents view with real data
- Last document resume
- Image upload to Supabase Storage

**Merge:** PR `feature/phase-05-editor` → `dev` → `main` when exit criteria met.
