# 03 — UX / UI Design

**Status:** draft  
**Last updated:** July 2026  
**UI reference:** [26-ui-mock-reference.md](26-ui-mock-reference.md) (clickable mock in [`ui-mock/`](../ui-mock/))

## Context

Rhodes must feel like a native writing tool — usable without memorizing shortcuts, yet as reduced as possible. Not a typical SaaS layout (permanent sidebars, dashboard grids).

## Decision

**Editor-first with On-Demand-Chrome:** a slim header for orientation; sidebars and template pages appear only when needed; Cmd+K supplements (does not replace) visible controls.

## Specification

### Leitprinzip

> Visible when needed, invisible while writing.

### UI states

#### State A — Writing (default, Zen)

- Last document open automatically (zero-click resume)
- Slim header: two zones — context left (Scope, Documents, title) · actions right (search, library, plus, profile, theme) — see [03b](03b-design-references.md)
- Header **auto-hides** after 2s of continuous typing
- Editor centered, max 720px
- Insight indicator on right edge (Lucide `lightbulb` in violet pill) when matches exist

#### State B — Right panel (Insights / Ask / Properties tabs)

One panel, segmented tabs — never multiple sidebars. See [03b-design-references.md](03b-design-references.md).

Triggered by: insight indicator, `sparkles` Ask in bubble menu, or Properties tab.

| Tab | Width | Content |
|-----|-------|---------|
| Insights | 320px / 45% expanded | Top matches, relevance %, "Why relevant?" |
| Ask | 320px | KI chat scoped to workspace |
| Properties | 320px | Tags, status, custom fields, history link |

Quote flow: select text in expanded insight → floating „Insert quote“ → blockquote + backlink.

#### State C — (merged into State B Properties tab)

Metadata lives in right panel **Properties** tab — not a separate sidebar state.

#### State D — Documents view

Triggered by: header „Documents“ (`files` icon). Recent / All tabs + inline search. See 03b wireframe State D.

#### State D2 — Template picker (transient)

Triggered by: `+` → "From template" — **not** the app start screen.

- Back link to editor
- Template cards: Blank, Meeting Minutes, Report, Product Spec
- Recent documents list below (max 5)
- Selecting template injects structure → returns to editor

#### State E — Cmd+K palette

Triggered by: `search` icon or Cmd+K. See 03b wireframe State H.

#### State F — Library view

Triggered by: header `book-open`. See 03b wireframe State F.

### Header specification

See [03b-design-references.md](03b-design-references.md) section 5 for full anatomy.

| Zone | Items |
|------|-------|
| Context (left) | Scope dropdown, Documents, document title |
| Actions (right) | Search, Library, New, Profile, Theme toggle |

Lucide icons only. No emojis.

### What we avoid

- Permanent left sidebar with file tree
- Dashboard grid as home screen
- Omnipresent action bar with 6+ buttons
- Two-column layout by default
- Colorful badges, widgets, empty-state illustrations

#### State G — Settings overlay (on-demand)

Triggered by: Avatar → Settings.

- Full-screen or slide-over overlay; editor stays mounted
- Sections: Profile, Security, Preferences, Spaces, Team, Billing, Privacy
- See [23-user-settings-and-spaces.md](23-user-settings-and-spaces.md), [24-privacy-user-tools.md](24-privacy-user-tools.md), [25-billing-lemonsqueezy.md](25-billing-lemonsqueezy.md)

#### Auth pages (unauthenticated)

Routes: `/auth/login`, `/auth/register`, `/auth/forgot-password` — minimal chrome. See [22-authentication-and-accounts.md](22-authentication-and-accounts.md).

### Performance UX

- Sidebar expand: `transition: transform 0.25s ease-out` (GPU-accelerated)
- No full-page skeleton loaders during typing
- Insight API calls debounced 3000ms; never block editor input

### Accessibility

- All header actions keyboard-reachable (Tab order)
- Sidebar trap focus when open; Escape closes
- `prefers-reduced-motion`: disable sidebar animation

## Open questions

- Library: full-screen vs slide-over panel?
- Insight sidebar: persist open state per session?

## Dependencies

- [03a-design-language.md](03a-design-language.md)
- [03b-design-references.md](03b-design-references.md)
- [20-workflows.md](20-workflows.md)
- [22-authentication-and-accounts.md](22-authentication-and-accounts.md)
- [23-user-settings-and-spaces.md](23-user-settings-and-spaces.md)
