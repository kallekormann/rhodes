# Phase 04 — UI Foundation

**Status:** planned  
**Depends on:** Phase 03  
**Blocks:** Phase 05  
**Estimated duration:** 5–7 days

---

## Objectives

1. Port the **design system** from `ui-mock/` into the production Next.js app.
2. Build the **app shell** matching all major navigable views from the mock.
3. Wire scope switcher to **real workspaces** from Supabase.
4. Implement theme (light/dark/system) and Cmd+K modal shell.
5. **No TipTap yet** — editor view shows placeholder content.

---

## Prerequisites

- Phase 03 exit criteria met (authenticated users, workspaces in DB).
- ui-mock running locally for side-by-side comparison (`cd ui-mock && npm run dev`).

---

## Canonical spec references

- [26-ui-mock-reference.md](../docs/26-ui-mock-reference.md) — **mandatory UI reference**
- [03-ux-ui-design.md](../docs/03-ux-ui-design.md) — layout states A–H
- [03a-design-language.md](../docs/03a-design-language.md)
- [03b-design-references.md](../docs/03b-design-references.md) — tokens, wireframes
- [02-information-architecture.md](../docs/02-information-architecture.md)
- [adr/006-editor-first-on-demand-chrome.md](../docs/adr/006-editor-first-on-demand-chrome.md)

---

## Docker services touched

None directly — UI connects to Supabase API from Phase 01/03.

---

## File checklist

```
apps/web/src/
├── styles/
│   ├── tokens.css                  # Copy verbatim from ui-mock
│   ├── global.css                  # Copy + adapt for Next.js
│   └── scrollbar.css
├── components/                     # Port from ui-mock/src/components/
│   ├── Button.tsx + Button.css
│   ├── Input.tsx + Input.css
│   ├── IconButton.tsx
│   ├── AppHeader.tsx + AppHeader.css
│   ├── ScopeSwitcher.tsx + ...
│   ├── Toast.tsx + ToastContainer
│   ├── Modal.tsx, Dialog.tsx
│   ├── TabBar.tsx
│   ├── CmdKModal.tsx
│   ├── Popover.tsx, Dropdown.tsx
│   └── ... (see component list below)
├── context/
│   └── AppContext.tsx              # View, theme, panel state, toasts
├── hooks/
│   ├── useWorkspaces.ts            # Fetch from Supabase
│   └── useTheme.ts
├── app/(app)/
│   ├── layout.tsx                  # AppProvider + shell
│   ├── editor/page.tsx             # Placeholder EditorView
│   ├── documents/page.tsx
│   ├── library/page.tsx
│   ├── settings/page.tsx
│   └── sticker-sheet/page.tsx      # Dev only: NODE_ENV or feature flag
└── views/                          # Port from ui-mock/src/views/
    ├── EditorView.tsx              # Placeholder body
    ├── DocumentsView.tsx           # Mock data → stub
    ├── LibraryView.tsx
    └── SettingsView.tsx            # Profile section stub
```

---

## Component port list (from ui-mock)

Port in priority order; preserve CSS class names and token usage:

### Foundations (first)
- `tokens.css`, `global.css`, `scrollbar.css`

### Actions & navigation
- `Button`, `IconButton`, `IconLabelButton`, `NavLink`, `TabBar`, `SegmentedControl`

### Forms (needed for settings shell)
- `Input`, `TextArea`, `Dropdown`, `Checkbox`, `Radio`/`RadioGroup`, `Toggle`
- `FieldControl`, `FieldPanel`, `popoverAlign.ts`

### Overlays & feedback
- `Popover`, `Modal`, `Dialog`, `Toast`/`ToastContainer`

### Content & lists
- `ListRow`, `ItemList`, `TemplateCard`, `SectionHeader`, `Divider`
- `NeutralPill`, `StatusPill`, `GroupLabel`

### Shell
- `AppHeader`, `ScopeSwitcher` (+ `ScopeMenu`, `ScopeTrigger`, `SpaceCreateModal`)
- `CmdKModal`, `InsightDot` (static, no AI yet)
- `RightPanel` (shell with empty tabs)

### Defer to later phases
- `EditorBody`, `BubbleMenu`, `SlashMenu`, comment components → Phase 05
- `AskComposer`, `ChatMessageBubble` → Phase 07
- `DropZone` (functional) → Phase 06

---

## Step-by-step tasks

### 1. Copy design tokens

```bash
cp ui-mock/src/styles/tokens.css apps/web/src/styles/tokens.css
cp ui-mock/src/styles/global.css apps/web/src/styles/global.css
```

Import in root `layout.tsx`. **Do not rename token variables** — production must use same names per [26-ui-mock-reference.md](../docs/26-ui-mock-reference.md).

### 2. Adapt components for Next.js

For each component:
- Add `'use client'` where hooks/events used
- Replace mock imports with `@/` path aliases
- Use `lucide-react` (already in ui-mock)
- Keep co-located `.css` files (mock uses CSS modules pattern without modules — match exactly)

### 3. AppContext

Port `ui-mock/src/context/AppContext.tsx`:
- `view`: `editor` | `documents` | `library` | `settings` | `sticker-sheet` | `templates`
- `theme`: `light` | `dark` | `system`
- `rightPanel`: `open` | `closed`, `activeTab`: `insights` | `ask` | `properties`
- `toasts`: array + dismiss
- `cmdKOpen`: boolean

Replace mock scope data with `useWorkspaces()` hook.

### 4. Routing strategy

**Option (recommended):** Next.js App Router pages map to views; `AppHeader` uses `useRouter()` for navigation.

| Mock view | Next.js route |
|-----------|---------------|
| `editor` | `/editor` |
| `documents` | `/documents` |
| `library` | `/library` |
| `settings` | `/settings` |
| `sticker-sheet` | `/sticker-sheet` (dev only) |
| `templates` | `/templates` |

Default authenticated route `/` → redirect `/editor`.

### 5. Scope switcher (real data)

**`useWorkspaces.ts`:**
```typescript
// Fetch workspaces where user is member
const { data } = await supabase
  .from('workspace_members')
  .select('role, workspaces(id, name, is_team_workspace)')
  .eq('user_id', userId);
```

Persist `activeWorkspaceId` in localStorage + context. Header label updates on switch.

### 6. Theme

- Read `profiles` or `auth.users.theme` preference
- Apply `data-theme="light"|"dark"` on `<html>`
- Header toggle + Settings (wired in Phase 08)
- Respect `prefers-color-scheme` when theme = `system`

### 7. Cmd+K modal

Port `CmdKModal.tsx`:
- Keyboard shortcut `⌘K` / `Ctrl+K`
- Commands: Go to Documents, Library, Settings, New document (stub), Ask panel (stub)
- Fuzzy filter on command list

### 8. Editor placeholder

`EditorView.tsx`:
- 3-column grid CSS (gutters + 720px column) from mock
- Header auto-hide on scroll (port CSS/JS from mock)
- Document meta row: scope label, title input (read-only placeholder), Properties button opens right panel
- Body: "Start writing…" placeholder — no TipTap yet

### 9. Sticker sheet (dev QA)

Port `StickerSheetView.tsx` — all component showcases. Gate route:
```typescript
if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_STICKER_SHEET) {
  notFound();
}
```

### 10. Visual QA pass

Open ui-mock and production app side-by-side:
- Header height, spacing, font sizes
- Light + dark mode
- Scope switcher dropdown
- Documents view layout
- Settings overlay layout

Log intentional deviations in [19-open-decisions.md](../docs/19-open-decisions.md).

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ENABLE_STICKER_SHEET` | Optional: enable sticker sheet in staging |

No new Docker env vars this phase.

---

## Testing checklist

- [ ] Tokens match ui-mock (spot-check `--color-accent`, `--space-md`, editor vars)
- [ ] All shell routes navigable via header + Cmd+K
- [ ] Scope switcher lists real workspaces from DB
- [ ] Switching workspace updates header label
- [ ] Light/dark toggle works; persists across reload
- [ ] Right panel opens/closes; tabs switch (empty content OK)
- [ ] Toast notifications fire on test action
- [ ] Sticker sheet renders all ported components
- [ ] Editor placeholder: 720px column, header auto-hide on scroll
- [ ] Settings overlay: back link returns to editor
- [ ] No layout shift vs ui-mock at 1440px viewport

---

## Exit criteria

1. Design tokens and core component library ported.
2. App shell navigable; matches mock layout structurally.
3. Scope switcher reads real workspaces.
4. Theme system functional (light/dark/system).
5. Cmd+K modal works with navigation commands.
6. Sticker sheet available for component QA in dev.
7. Editor view is placeholder only (TipTap deferred to Phase 05).

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| CSS drift from mock | Sticker sheet QA; copy CSS verbatim first |
| Next.js `'use client'` boundary confusion | Keep data fetching in hooks; pass props down |
| Lucide icon version mismatch | Pin same version as ui-mock (`^1.24.0`) |
| Routing vs client-side view switch | Document mapping; keep AppContext `view` in sync with route |

---

## Deliverables

- `styles/tokens.css`, `global.css` in production app
- ~30 ported components
- App shell with 6 routes
- AppContext + useWorkspaces hook
- Theme + Cmd+K
- Sticker sheet (dev)

**Merge:** PR `feature/phase-04-ui-foundation` → `dev` → `main` when exit criteria met.
