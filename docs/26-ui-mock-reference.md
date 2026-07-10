# 26 — UI Mock Reference

**Status:** accepted  
**Last updated:** July 2026  
**Code:** [`rhodes-app/ui-mock/`](../ui-mock/)  
**Live sticker sheet:** Header overflow → Design system (or `view === "sticker-sheet"`)

---

## Context

Before building the production Rhodes app, we invested in a **clickable UX mock** — a Vite + React prototype that implements layout, interaction patterns, and a growing component library grounded in [03-ux-ui-design.md](03-ux-ui-design.md), [03a-design-language.md](03a-design-language.md), and [03b-design-references.md](03b-design-references.md).

This document records what the mock contains and establishes a **mandatory reference rule** for the real application.

---

## Decision

**When scaffolding and implementing the production Rhodes app, the UI mock is the canonical interaction and visual reference.** Spec docs define *why* and *what*; the mock defines *how it should look and behave* in the browser.

Deviations require an explicit decision in [19-open-decisions.md](19-open-decisions.md) or a new ADR — not silent drift during implementation.

---

## How to run

```bash
cd rhodes-app/ui-mock
npm install
npm run dev
```

Build check: `npm run build`

Entry points:

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Shell, view routing |
| `src/context/AppContext.tsx` | Global UI state (view, theme, panel, scopes, toasts) |
| `src/views/StickerSheetView.tsx` | Full design system gallery |
| `src/styles/tokens.css` | Design tokens (light + dark) |

---

## Relationship to specification docs

| Spec | Mock implementation |
|------|---------------------|
| [03-ux-ui-design.md](03-ux-ui-design.md) States A–H | All major states implemented as navigable views |
| [03b-design-references.md](03b-design-references.md) | Tokens, wireframes, Lucide icons, float chrome |
| [02-information-architecture.md](02-information-architecture.md) | Scope switcher, Documents, Library, editor |
| [23-user-settings-and-spaces.md](23-user-settings-and-spaces.md) | Settings overlay, Profile fields, Spaces management |
| [07-individual-vs-team.md](07-individual-vs-team.md) | Multiple personal spaces + team spaces |
| [11-editor-tiptap.md](11-editor-tiptap.md) | **Not implemented** — mock uses contenteditable blocks, not TipTap |

---

## Application states (views)

The mock uses client-side view switching (`AppView` in `AppContext`). Each maps to a UX state from the spec.

| View | Spec state | File | Summary |
|------|------------|------|---------|
| `editor` | A, B | `views/EditorView.tsx` | Default writing surface; right panel; insight dot |
| `documents` | D | `views/DocumentsView.tsx` | Overview: templates strip, recent/all/favorites, search |
| `templates` | — | `views/TemplatesView.tsx` | Template gallery + detail side panel |
| `library` | E | `views/LibraryView.tsx` | Drop zone + indexed sources list |
| `settings` | G | `views/SettingsView.tsx` | Full-screen settings overlay with left nav |
| `sticker-sheet` | — | `views/StickerSheetView.tsx` | Component library / design QA |

### Global chrome

| Feature | Component | Behavior |
|---------|-----------|----------|
| Header | `AppHeader.tsx` | Scope switcher, Documents breadcrumb, search, new doc, overflow menu |
| Overflow menu | `AppHeader.tsx` | Library, Profile & settings, theme toggle, Design system |
| Cmd+K | `CmdKModal.tsx` | Command palette; opens editor, documents, library, Ask panel |
| Toasts | `Toast.tsx` | Success / error / info notifications |
| Theme | `AppContext` + `tokens.css` | Light / dark via `data-theme`; header toggle + Settings Profile |

### Scope (workspace) model

Implemented in `data/scopes.ts` + `ScopeSwitcher.tsx`:

- **Multiple personal spaces** (private, owner) — Option B from settings spec
- **Team spaces** with roles (owner / admin / member)
- Create personal / team space via switcher or Settings → Spaces
- Active scope persists in context; affects header label

---

## Screen inventory

### Editor (`EditorView`)

- **3-column block layout:** left gutter (drag handle) · 720px text column · right gutter (comments)
- CSS vars: `--editor-gutter-left`, `--editor-gutter-right`, `--editor-grid-gap`
- **Header auto-hide** on scroll down in editor; reveal zone at top on hover
- **Document meta row:** scope label, editable title, favorite, Properties button
- **Insight dot** (bottom-right) opens right panel → Insights
- **Right panel** (`RightPanel.tsx`): single panel, three tabs — never multiple sidebars

### Right panel tabs

| Tab | Content |
|-----|---------|
| **Insights** | Ranked matches with relevance %, source links, “Why relevant?” |
| **Ask** | Chat thread (`ChatMessageBubble`) + `AskComposer` with status row |
| **Properties** | Plain-variant fields: status, owner, summary, due date, date range |

Tab bar uses `TabBar` (replaces earlier `SegmentedControl` in panel).

### Editor body (`EditorBody.tsx`)

Block-based mock editor (not TipTap). Supported block kinds: `text`, `h2`, `divider`, `image`, `table`.

| Feature | Components | Interaction |
|---------|------------|-------------|
| **Floating toolbar** | `BubbleMenu`, `LinkPopover`, `CommentPopover` | On text selection; above/below placement; Ask, B/I/lists, link, comment |
| **Slash menu** | `SlashMenu`, `editorSlash.ts` | `/` in paragraph → filterable insert menu (paragraph, divider, table, image) |
| **Comments** | `CommentMarker`, `CommentNoteBubble`, `renderCommentHighlights` | Marker in right gutter; hover → highlight anchors; click → thread; bubble menu to add |
| **Drag & drop** | `BlockDragHandle`, `BlockDropZone`, `editorBodyUtils.ts` | Grip on row hover; tilt while dragging; “Drop here” between blocks |
| **Tables** | `TableInsertModal`, `EditorTable` | `/table` or slash menu; configurable rows/cols; editable cells; + row/column |

**Comment interaction spec (implemented):**

- Default: full paragraph text visible, no highlights
- Hover comment marker: subtle highlight on anchor span(s)
- Click marker: open `CommentThread` in right gutter
- Hover individual comment in thread: emphasized highlight on that anchor
- Marker: neutral gray (not accent purple)

**Demo data:** `data/editorTypes.ts` — initial comments on block `p-3`; selection comment flow on `p-2`.

### Documents (`DocumentsView`)

- Templates section with `TemplateCard` grid + “More templates” `NavLink`
- Segmented tabs: Recent / All / Favorites
- Search via `Input` with icon
- Grouped `ListRow` items with `StatusPill`
- Row click → editor with document title/id

### Templates (`TemplatesView`)

- Filterable template grid
- `TemplateDetailPanel` slide-over with metadata and use action

### Library (`LibraryView`)

- `DropZone` for file upload affordance
- Source list with indexing status (`StatusPill` + loader)

### Settings (`SettingsView`)

Matches State G wireframe in [03b-design-references.md](03b-design-references.md):

- **Back link:** `NavLink` with `ArrowLeft` + “Settings” (accent internal link) → returns to editor
- **Left nav:** Profile, Security, Preferences, Spaces, Team, Billing, Privacy
- **Profile (implemented):** `Input` (display name, email disabled), `Dropdown` field (language), `RadioGroup` (theme: System / Light / Dark)
- **Spaces (implemented):** Personal + Team lists, switch active, create modals
- Other sections: placeholder copy

---

## Component library

All reusable primitives live in `ui-mock/src/components/`. The **sticker sheet** (`StickerSheetView`) is the visual catalog — use it for QA before shipping production UI.

### Foundations

| Component | Variants / notes |
|-----------|------------------|
| `tokens.css` | Colors, spacing, typography, shadows, motion, editor tokens |
| `global.css` | App shell, canvas views, typography utility classes |
| `scrollbar.css` | Overlay scrollbar (fade on idle) |

### Actions & navigation

| Component | Notes |
|-----------|-------|
| `Button` | primary, secondary, ghost; default + small |
| `IconButton` | Icon-only with aria-label |
| `IconLabelButton` | Meta actions (e.g. Properties) |
| `NavLink` | Internal accent links; default + small; optional Lucide icon (left) |
| `TabBar` | Panel tabs, documents-style tabs |
| `SegmentedControl` | Legacy; still used on Documents toolbar |

### Forms & fields

| Component | Variants |
|-----------|----------|
| `Input` | `field` (bordered, forms) · `plain` (properties sidebar) |
| `TextArea` | Label, hint, multi-line |
| `Dropdown` | `menu` · `field` · `plain`; searchable option |
| `DatePicker` / `DatePickerField` | Calendar panel + field trigger |
| `DateRangePicker` / `DateRangeField` | Range selection |
| `Checkbox` | Label + optional description |
| `Radio` / `RadioGroup` | Stacked radio options |
| `Toggle` | On/off switch |
| `FieldControl` / `FieldPanel` | Shared popover shell; `useFieldPanel()` + `popoverAlign.ts` for auto left/right alignment |

### Overlays & feedback

| Component | Notes |
|-----------|-------|
| `Popover` | sm / md / lg; top/bottom placement |
| `Modal` / `Dialog` | Full modal vs lightweight confirm |
| `Toast` / `ToastContainer` | Auto-dismiss notifications |
| `DropZone` | Dashed upload target |

### Content & lists

| Component | Notes |
|-----------|-------|
| `ListRow` / `ItemList` | Document rows, selectable state |
| `TemplateCard` / `TemplateCardGrid` | Overview template tiles |
| `SectionHeader` | Title + `NavLink` action |
| `GroupLabel` / `SectionTitle` | Uppercase section labels |
| `Divider` | Section separator |
| `NeutralPill` / `StatusPill` | Tags and indexing status |
| `InsightDot` | Floating insight affordance |

### Editor-specific

| Component | Notes |
|-----------|-------|
| `BubbleMenu` | Float chrome tokens; link + comment popovers |
| `LinkPopover` | External URL + internal document search |
| `CommentPopover` | New comment textarea |
| `CommentMarker` | Gray count bubble in gutter |
| `CommentNoteBubble` | Thread item; author, date, text |
| `SlashMenu` | Slash command palette |
| `BlockDragHandle` | Row grip |
| `BlockDropZone` | Drop indicator |
| `EditorTable` | In-document table block |
| `TableInsertModal` | Row/column configuration |
| `AskComposer` | Multiline input + status + send |
| `ChatMessageBubble` | You (right) / Rhodes (left) chat bubbles |

### Scope & settings

| Component | Notes |
|-----------|-------|
| `ScopeSwitcher` / `ScopeMenu` / `ScopeTrigger` | Header workspace picker |
| `SpaceCreateModal` | Create personal / team space |
| Showcase components | `*Showcase.tsx` — isolated demos for sticker sheet |

---

## Design tokens

Source of truth: `ui-mock/src/styles/tokens.css`

Key groups:

- **Surfaces:** `--color-bg`, `--color-bg-elevated`, `--color-surface`, borders
- **Text:** primary, secondary, tertiary, inverse
- **Accent:** purple family (`--color-accent`, muted, subtle, on-accent)
- **Float chrome:** `--color-float-bg`, `--color-float-border`, `--shadow-float-chrome` (bubble menu, slash menu, popovers)
- **Editor:** `--color-editor-bg`, selection, cursor
- **Semantic:** success, warning, error
- **Spacing:** `--space-xs` … `--space-2xl`
- **Radius, shadow, duration, focus ring**

Light theme on `:root` / `[data-theme="light"]`; dark on `[data-theme="dark"]`.

**Production rule:** Copy token names and values into the production design system first; do not invent parallel naming.

---

## Mock data

| File | Contents |
|------|----------|
| `data/documents.ts` | Document list, favorites, groups |
| `data/templates.ts` | Template catalog |
| `data/scopes.ts` | Personal + team scopes, limits |
| `data/editorTypes.ts` | Block types, initial comments |
| `data/librarySources.ts` | Library source metadata |

All data is in-memory; no API, auth, or persistence.

---

## Explicitly not in the mock

These are spec'd elsewhere but **not** implemented in the prototype:

| Area | See |
|------|-----|
| TipTap / ProseMirror editor | [11-editor-tiptap.md](11-editor-tiptap.md) |
| Real auth, Supabase, RLS | [22-authentication-and-accounts.md](22-authentication-and-accounts.md) |
| Backend, sync, offline | [12-offline-sync.md](12-offline-sync.md) |
| RAG / Ollama / embeddings | [05-ai-and-rag.md](05-ai-and-rag.md) |
| Billing / LemonSqueezy | [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md) |
| Mobile / responsive breakpoints | — |
| i18n string tables | [21-i18n.md](21-i18n.md) |
| Security, MFA, privacy tools | [22](22-authentication-and-accounts.md), [24](24-privacy-user-tools.md) |
| Settings sections beyond Profile + Spaces | Placeholder only |

---

## Production migration checklist

When starting the real Rhodes app:

1. **Read this doc** and walk through the mock locally (`npm run dev`).
2. **Port `tokens.css`** into the production CSS / Tailwind config — preserve token names.
3. **Port components** from `ui-mock/src/components/` — prefer move + adapt over rewrite.
4. **Match layouts pixel-structurally** — especially editor 3-column grid, 720px column, right panel width, settings overlay.
5. **Match interactions** — verify against sticker sheet and editor demo before marking features done.
6. **Replace `EditorBody`** with TipTap equivalents that preserve the same UX contracts (bubble menu, slash menu, comments gutter, drag handles).
7. **Wire real data** — scopes, documents, comments, library sources — behind the same UI shapes.
8. **Log deviations** — any intentional change to spacing, colors, or flows needs a decision record.

Suggested production stack alignment (from ADRs): Next.js app, TipTap editor, Supabase — UI layer should still mirror mock components and class semantics where possible.

---

## Dependencies

- [03-ux-ui-design.md](03-ux-ui-design.md) — layout states
- [03a-design-language.md](03a-design-language.md) — principles
- [03b-design-references.md](03b-design-references.md) — wireframes + tokens origin
- [23-user-settings-and-spaces.md](23-user-settings-and-spaces.md) — settings overlay
- [adr/003-tiptap-editor.md](adr/003-tiptap-editor.md) — production editor choice
- [adr/006-editor-first-on-demand-chrome.md](adr/006-editor-first-on-demand-chrome.md) — chrome philosophy

---

## Open questions

| Question | Notes |
|----------|-------|
| Component packaging | Monorepo package `@rhodes/ui` vs copy-once into Next.js app? |
| Tailwind vs CSS modules | Mock uses plain CSS + tokens; decide before port |
| TipTap comment anchors | Mock uses character offsets; production needs ProseMirror marks |
