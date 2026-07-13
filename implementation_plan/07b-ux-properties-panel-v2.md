# 07b — Properties Panel v2 (In-Panel Stages)

**Status:** signed off for implementation (2026-07-13)  
**Supersedes:** flyout sections in `07b-ux-properties-studio.md`  
**Parent:** `07b-properties-scope-and-views.md`

---

## Sign-off decisions

| Decision | Choice |
|----------|--------|
| Row layout | Horizontal **40% label / 60% value** |
| Navigation | **In-panel stages** — no side flyout, no panel widening |
| Property scope (UX) | **Document-based** — user manages properties on the current document |
| Data layer (v1) | Workspace `metadata_schemas` APIs; UI copy treats properties as document-scoped until per-document schema storage exists |
| Group containers | **Boxed cards only for groups** — single fields are plain rows |
| Option colors | **Deferred** — chip editor only in v1 |
| Drag reorder | **Deferred** — grip handle visible in Manage; DnD in P1 |

---

## Stage machine

```
view ──[Manage]──► manage ──[+ Add Property]──► add
  ▲                  ▲                           │
  └────[◄ Back]──────┴──────[◄ Cancel]───────────┘
                              [Save & Add] ───────► manage (on success)
```

| Stage | Body | Action bar |
|-------|------|------------|
| `view` | Horizontal rows + group cards; live inputs | `[ Manage ]` secondary |
| `manage` | Same rows; static muted values; hover edit/remove | `[ ◄ Back ]` · `[ + Add Property ]` |
| `add` | TabBar: Presets / Custom Single / Custom Group | `[ ◄ Cancel ]` · `[ Save & Add ]`* |

\*Save & Add only on Custom Single / Custom Group tabs.

---

## Section A — Stage 1: View & Work

### PropertiesPanelChrome

| Field | Spec |
|-------|------|
| **Stage** | View |
| **Job** | Scrollable container for all property rows |
| **Layout** | `padding: var(--space-md)`; flex column; overflow-y auto |
| **States** | Loading caption; empty state caption |
| **Transitions** | Content replaced entirely in Manage / Add |

### SystemReadonlyRow (Created, Created by, Word count)

| Field | Spec |
|-------|------|
| **Stage** | View (also visible in Manage as static text) |
| **Job** | Show system metadata without editing |
| **Layout** | 40/60 grid; label 11px uppercase secondary; value 12px secondary |
| **States** | Read-only text in `dd` |
| **Transitions** | Unchanged across stages |

### PropertyRow (single field)

| Field | Spec |
|-------|------|
| **Stage** | View |
| **Job** | Scan label and edit value inline |
| **Layout** | `grid-template-columns: 40% 1fr`; label left 11px uppercase `var(--color-text-secondary)`; value right 12px `var(--color-text)`; 1px divider below |
| **States** | Empty → control placeholder; AI → accent hint on label |
| **Transitions** | Manage: becomes `PropertyManageRow` with static value |

### GroupCard

| Field | Spec |
|-------|------|
| **Stage** | View |
| **Job** | Nest related sub-properties under a collapsible group |
| **Layout** | Box: `background var(--color-surface-secondary)`, `border 1px var(--color-border-subtle)`, `radius 6px`, `padding var(--space-sm)`; header with `▼/►` + group name 14px semibold |
| **States** | Collapsed hides sub-rows; repeatable shows instance label + add/remove |
| **Transitions** | Manage: boxed header + static sub-values |

### ViewActionBar

| Field | Spec |
|-------|------|
| **Stage** | View |
| **Job** | Enter layout management |
| **Layout** | `panel-actionbar`; `Button` secondary default **Manage**; left-aligned |
| **States** | — |
| **Transitions** | Click → `manage` stage |

---

## Section B — Stage 2: Manage (summary)

### PropertyManageRow

| Field | Spec |
|-------|------|
| **Stage** | Manage |
| **Job** | Show current value as context while curating layout |
| **Layout** | 40/60 row; grip (left edge on hover); label; muted static value; `✎` edit + `Remove` ghost small (right) |
| **Transitions** | Edit → `add` / Custom tab pre-filled; Remove → delete dialog |

---

## Section C–F — Stage 3: Add (summary)

- **TabBar:** Presets | Custom Single | Custom Group
- **Presets:** search (optional v1), categories, `[+]` / Added badge
- **Custom Single / Group:** existing composers, footer on panel action bar

---

## Data model note (v1)

Properties are presented as **document properties**. Create/delete uses workspace schema APIs (`useMetadataSchemas`). Values live on `document.metadata`. Future: per-document schema table if workspace-wide definitions are incorrect for the product model.
