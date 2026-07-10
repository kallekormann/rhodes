# Rhodes UI Mock

**Canonical UX reference for the production Rhodes app.**

Clickable prototype (Vite + React + TypeScript) implementing layout, interactions, and a component library from the Rhodes spec. Before building production UI, read **[docs/26-ui-mock-reference.md](../docs/26-ui-mock-reference.md)** — it inventories everything here and defines the mandatory reference rule.

## Purpose

- Validate editor-first, on-demand-chrome UX before TipTap/backend work
- Provide a browsable design system (sticker sheet) for QA
- Supply components and tokens that migrate into the real app

## Run

```bash
cd rhodes-app/ui-mock
npm install
npm run dev
```

Open the app, then use **header overflow (⋯) → Design system** for the full component gallery.

## Quick tour

| Action | Result |
|--------|--------|
| **Documents** in header | Overview: templates, recent/all/favorites |
| **Library** (overflow menu) | Drop zone + source list |
| Document row click | Editor |
| Insight dot (editor, bottom-right) | Right panel → Insights |
| Select highlighted text | Bubble menu → Ask opens Ask tab |
| **⌘K** / search icon | Command palette |
| **Escape** | Close panel or Cmd+K |
| Profile (overflow) | Settings overlay |
| **Design system** (overflow) | Sticker sheet |

## Structure

```
src/
  styles/
    tokens.css          # Design tokens — copy to production first
    global.css          # Shell, canvas views, typography utilities
  context/
    AppContext.tsx      # View, theme, panel, scopes, Cmd+K, toasts
  components/           # Reusable UI + editor chrome (~50 components)
  views/                # editor, documents, templates, library, settings, sticker-sheet
  data/                 # Mock documents, scopes, templates, editor blocks
```

## What's implemented vs not

**Implemented:** All major app states, design system, editor interactions (bubble/slash/comments/drag/table), Ask panel, scope switcher, settings Profile + Spaces.

**Not implemented:** TipTap, auth, API, offline sync, billing, mobile layout, most settings sections (placeholders).

See [26-ui-mock-reference.md](../docs/26-ui-mock-reference.md) for the full inventory.

## Production rule

> When building the real Rhodes app, this mock is the canonical visual and interaction reference. Spec docs explain intent; the mock shows the target UI. Deviations require an explicit decision.

Migration: port `tokens.css` and `components/` with minimal structural change; replace `EditorBody` with TipTap while preserving the same UX contracts.
