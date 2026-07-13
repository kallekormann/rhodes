# 07b — Properties Flyout UX/UI QA

**Date:** 2026-07-13  
**Scope:** Properties tab + `PropertyAddFlyout` (flows a–d)  
**Spec:** [`07b-ux-properties-studio.md`](./07b-ux-properties-studio.md)  
**Status:** v2 in-panel stages implemented (2026-07-13)

See [`07b-ux-properties-panel-v2.md`](./07b-ux-properties-panel-v2.md) for signed-off architecture.

---

## v2 pivot (implemented)

| Change | Status |
|--------|--------|
| Retire side flyout + panel widening | Done |
| 3 in-panel stages: view / manage / add | Done |
| Horizontal 40/60 property rows | Done |
| Group boxed cards (collapsible) | Done |
| Manage: static values + edit/remove on hover | Done |
| Add: Presets / Custom Single / Custom Group tabs | Done |
| Document-scoped UX copy | Done |
| Data: workspace schema APIs (v1 bridge) | Documented in v2 spec |


## Batch 1 fixes (2026-07-13)

| ID | Status | Fix |
|----|--------|-----|
| QA-100 | **fixed** | Typography hierarchy — labels `--color-text` 500; fixed broken `--text-secondary` refs |
| QA-101 | **fixed** | Action bar — symmetric padding, 48px min-height, button vertical centering |
| QA-102 | **fixed** | Removed section titles (`This document`, `Workspace properties`) from panel |
| QA-103 | **fixed** | Removed Workspace Properties duplicate list; manage mode Remove on rows when flyout open |
| QA-104 | **fixed** | Property labels darker / readable (`--color-text` not tertiary) |
| QA-105 | **fixed** | Stacked layout — label above control; spacing between fields and groups |
| QA-106 | **fixed** | Footer CTA renamed to **Manage**; opens flyout; rows switch to Remove in manage mode |
| QA-006 | **superseded** | Section titles removed entirely (not uppercase) |
| QA-017 | **resolved** | Footer stays **Manage** while flyout open (intentional manage entry) |
| QA-018 | **superseded** | Workspace index removed; remove via manage mode on document rows |


## How to use this doc

Walk each surface in the running app. For every issue:

1. Assign an **ID** (`QA-###`)
2. Note **surface** (panel / flyout pick / flyout compose / workspace list)
3. Rate **severity:** `blocker` · `major` · `minor` · `polish`
4. Add **screenshot or steps** if helpful

**Surfaces checklist**

| # | Surface | Flow | Pass? |
|---|---------|------|-------|
| 1 | Properties panel — empty state | — | ☐ |
| 2 | Properties panel — property values (stacked) | — | ☐ |
| 3 | ~~WORKSPACE PROPERTIES index~~ | — | removed |
| 4 | Panel footer — **Manage** | — | ☐ |
| 5 | Flyout — pick presets (fields) | (a) | ☐ |
| 6 | Flyout — pick presets (groups) | (a) | ☐ |
| 7 | Flyout — customize field preset | (b) | ☐ |
| 8 | Flyout — customize group preset | (b) | ☐ |
| 9 | Flyout — new custom field | (c) | ☐ |
| 10 | Flyout — new custom group | (d) | ☐ |
| 11 | Panel width transition (352 → 672) | — | ☐ |
| 12 | Delete property / group dialogs | — | ☐ |

---

## Issues — code/spec audit (pre-filled)

Issues found by comparing implementation to signed-off UX spec. **Confirm or reject in app.**

### Layout & spatial

| ID | Severity | Surface | Issue | Spec / expected | File(s) |
|----|----------|---------|-------|-----------------|---------|
| QA-001 | major | Group preset pick | Group presets render as **flat sub-field rows** + inner `h5` group title. Should be one **group block preview** (`GroupInstanceSection` / grouped `props-list`). | Wireframe (a): single group preview block | `PropertyPresetRow.tsx` |
| QA-002 | minor | Group preset pick | **Triple labeling:** section title "Groups" + row `h5` group name + meta line — redundant hierarchy. | One group header in preview only | `PropertyPresetRow.tsx`, `PropertyPickPanel.tsx` |
| QA-003 | ? | Panel + flyout | Opening flyout **widens entire right panel** to 672px (352+320). Editor canvas shrinks. Confirm this matches intended Notion-style in-context inspector vs overlay drawer. | D12: 352 + 320 columns | `RightPanel.css`, `tokens.css` |
| QA-004 | minor | Flyout compose | `SubPropertyEditorRow` stacks **vertically** (label, type, unit, remove each on own line). Wireframe shows **horizontal row** in 320px: `[Name] [Text ▾] [−]`. | SubPropertyEditorRow wireframe (d) | `SubPropertyEditorRow.css` |
| QA-005 | polish | Flyout | Slide-in animation on open; **no slide-out** on close. | Transitions table: slide out 150ms | `PropertyAddFlyout.css` |

### Typography & hierarchy

| ID | Severity | Surface | Issue | Spec / expected | File(s) |
|----|----------|---------|-------|-----------------|---------|
| QA-006 | minor | Properties panel | Section titles use **sentence case**: "This document", "Workspace properties". Spec uses **uppercase labels**: `THIS DOCUMENT`, `WORKSPACE PROPERTIES`. | Plane 5 typography | `PropertiesTab.tsx` |
| QA-007 | minor | Flyout header | Title + `← Presets` back control compete in 48px header; back link may wrap or crowd close button on long titles ("Customize …"). | 13px medium title, ghost back | `PropertyAddFlyout.tsx` |

### Component consistency

| ID | Severity | Surface | Issue | Spec / expected | File(s) |
|----|----------|---------|-------|-----------------|---------|
| QA-008 | major | Field compose | **Unit field not persisted** — `PropertyFieldComposer` collects `unit` for number type but `onCreate` omits it (`schemaOptionsWithUnit` never called). | Unit saved on number fields | `PropertyFieldComposer.tsx` |
| QA-009 | minor | Sub-property row | **Remove** uses `Button ghost small` with Trash icon **+** "Remove" label. Schema index uses text-only ghost Remove. Wireframe shows compact `−` control. | Consistent ghost small row actions | `SubPropertyEditorRow.tsx` |
| QA-010 | minor | Type picker | `PropertyTypeChipPicker` uses **custom pill buttons**, not shared `tag` / `tag--active` chip pattern used elsewhere (multi-select, options). | Spec: `tag--active` pattern | `PropertyTypeChipPicker.css` |
| QA-011 | minor | Preview rows | `SchemaFieldRow` `preview` adds class but controls still **look fully interactive** (same opacity/border as live fields). Only `pointer-events: none`. | Preview should read as non-editable | `SchemaFieldRow.tsx`, `GroupInstanceSection.css` |
| QA-012 | minor | Workspace group row | Expand/collapse uses **raw `<button>`**, not `Button` or `IconButton`. Different hover/focus from rest of DS. | Reuse DS components | `PropertySchemaIndexRow.tsx` |

### Interaction & behavior

| ID | Severity | Surface | Issue | Spec / expected | File(s) |
|----|----------|---------|-------|-----------------|---------|
| QA-013 | major | Flyout | **No focus trap** while flyout open. | Keyboard / focus section | `PropertyAddFlyout.tsx` |
| QA-014 | major | Flyout | **Escape** does not close flyout or navigate pick → compose. | Keyboard / focus section | `PropertyAddFlyout.tsx` |
| QA-015 | major | Flyout compose | **No dirty-state guard** on `← Presets`, Cancel, or `×` close. | Escape → confirm if dirty | `PropertyAddFlyout.tsx` |
| QA-016 | minor | Preset add | **No success toast** after one-click Add; flyout just closes. | Transitions: "Toast + flyout close" | `PropertiesTab.tsx` |
| QA-017 | minor | Panel footer | **`+ Add property` stays visible** while flyout is already open (same CTA that opened it). May feel redundant or allow double-open confusion. | Single entry point? | `PropertiesTab.tsx` |
| QA-018 | major | Workspace index | **No Edit** action on workspace rows (spec lists Edit → opens flyout compose). Only Remove exists. Marked P2 in spec — confirm priority. | Schema index actions | `PropertySchemaIndexRow.tsx` |

### Field types & data

| ID | Severity | Surface | Issue | Spec / expected | File(s) |
|----|----------|---------|-------|-----------------|---------|
| QA-019 | minor | Type picker | Spec Choice group includes `radio`, `toggle`. Picker uses `checkbox` labeled "Yes/No" instead. Document renderers for radio/toggle not built. | 07b.3 follow-up | `PropertyTypeChipPicker.tsx` |
| QA-020 | minor | Sub-field types | `SubPropertyEditorRow` Dropdown omits `date_range`, `textarea` from spec subset (has textarea in SUB_FIELD_TYPES - good). No `toggle`. | SubPropertyEditorRow spec | `SubPropertyEditorRow.tsx` |

### Accessibility

| ID | Severity | Surface | Issue | Spec / expected | File(s) |
|----|----------|---------|-------|-----------------|---------|
| QA-021 | major | Flyout | Flyout is `<aside>` but **no `role="dialog"`**, `aria-modal`, or labelled-by tie to header title. | Focus trap + modal semantics | `PropertyAddFlyout.tsx` |
| QA-022 | minor | Preset preview | Preview controls are pointer-blocked but may still be **tab-focusable** inside flyout depending on browser. | preview = inert | `PropertyPresetRow.css` |

---

## Issues — visual review (Kalle)

| ID | Severity | Surface | Issue | Notes |
|----|----------|---------|-------|-------|
| QA-100 | major | Panel + flyout | Random light grey / black — no visual hierarchy | **Fixed** batch 1 |
| QA-101 | minor | Panel footer | Action bar too much bottom padding; button not vertically centered | **Fixed** batch 1 |
| QA-102 | major | Panel | Confusing section titles (`This document`, `Workspace properties`) | **Fixed** — titles removed |
| QA-103 | major | Panel | Workspace properties section — remove-only, not editable, duplicate of document list | **Fixed** — section removed; manage mode Remove |
| QA-104 | major | Panel | Property labels nearly unreadable (too light) | **Fixed** — `--color-text` labels |
| QA-105 | major | Panel | Two-column label/value grid — want label above control; group spacing | **Fixed** — stacked layout |
| QA-106 | major | Panel footer | Rename `+ Add property` → **Manage**; rows become Remove when flyout open | **Fixed** batch 1 |

_Add next round of feedback below._

| ID | Severity | Surface | Issue | Notes |
|----|----------|---------|-------|-------|
| QA-107 | | | | |

### Quick capture prompts

- Does the **352 + 320** widening feel right, or does the editor shrink too much?
- Are **preset rows** too tall / too dense / wrong alignment between preview and Add/Customize?
- Do **buttons** feel like the right size and variant everywhere?
- Are **inputs and dropdowns** the same height and border style as elsewhere in the app?
- Does **WORKSPACE PROPERTIES** feel clearly different from **THIS DOCUMENT**?
- Anything feel **card-like** or boxed that shouldn't be?
- **Flyout header** — alignment with tab bar header above?
- **Spacing** — padding in flyout body vs panel scroll area?
- **Group compose** — usable at 320px width?
- **Color** — flyout bg vs panel bg distinction?

---

## Fix batching (draft — do not implement until QA sign-off)

| Batch | Theme | IDs |
|-------|-------|-----|
| **1 (done)** | Panel typography, layout, manage mode | QA-100–106 |
| A | Spec compliance / bugs | QA-008, QA-001, QA-013–015, QA-021 |
| B | Component consistency | QA-009–012, QA-004 |
| C | Typography & polish | QA-006, QA-007, QA-005, QA-011, QA-016–017 |
| D | Deferred / P2 | QA-018, QA-019 |

---

## Sign-off

| Role | Status | Date |
|------|--------|------|
| UX audit (code) | Pre-filled | 2026-07-13 |
| Visual QA (Kalle) | Pending | |
| Fix batch approved | Pending | |
