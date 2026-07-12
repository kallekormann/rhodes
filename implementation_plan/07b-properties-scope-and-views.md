# Phase 07b — Properties, Scope Intelligence, and Views

**Status:** planned  
**Depends on:** Phase 07  
**Blocks:** Phase 08  
**Estimated duration:** 6–9 days

---

## Why this phase exists (between 07 and 08)

Phase 07 shipped the **mechanics** of properties: schema CRUD API, a Manage modal, AI auto-fill, and schema-driven value editing in the Properties tab. In practice the experience is **not yet usable**:

| Problem | Symptom |
|---------|---------|
| **Manage modal grows without bound** | Replace modal with **expanded sidebar** (Properties Studio): left = live Properties tab, center = builder, right = presets |
| **Add/remove feels broken** | Users cannot confidently add, preview, reorder, or remove properties; error states and success feedback are unclear |
| **No mental model** | It is unclear *why* properties matter, what they power downstream, or how they relate to the active **Scope** (workspace) |
| **Limited field builder** | `select` uses a textarea for options; no radio list type; yes/no is a generic checkbox buried in a long type dropdown — not a first-class **toggle** |
| **No scope-level lens** | Properties are per-document only in the sidebar; there is no way to see patterns across documents in a scope (status distribution, topics, stale drafts) |
| **Views not started** | Saved filters / metadata-driven discovery deferred from 05c and 08 — users cannot *use* properties to find or group work |

Phase 07b makes properties **understandable, pleasant to define, and valuable to use** before Phase 08 adds settings, teams, and admin surfaces.

---

## Objectives

1. **Redesign Properties tab + Properties Studio** — expanded sidebar (three columns), reliable add/remove/edit.
2. **Property builder** — presets for one-click add *plus* a guided builder (label → type → options → preview).
3. **Rich field types** — dropdown, **radio list**, **yes/no toggle**, multi-select chips; sensible display in the tab.
4. **Document the value loop** — in-product copy + dev docs: what properties do, where they flow in logic (AI, search, views).
5. **Scope property intelligence** — read aggregated metadata for the active scope (workspace): counts, facets, topic rollups.
6. **Views foundation (V1)** — saved views over documents in a scope, filterable by metadata; open from Documents view or Cmd+K stub.

---

## Prerequisites

- Phase 07 exit criteria met (Properties Manage API, AI auto-fill, schema-driven tab).
- `metadata_schemas` + `documents.metadata` path working (Phase 05c).
- Active scope / workspace switcher wired (`AppContext`, `useWorkspaces`).

---

## Canonical spec references

- [08-metadata-system.md](../docs/08-metadata-system.md) — three layers (system, AI, user-defined)
- [10-templates-and-views.md](../docs/10-templates-and-views.md) — saved views shape
- [07-ai-rag-and-insights.md §13](07-ai-rag-and-insights.md#13-document-properties--manage-ui-sidebar) — Phase 07 baseline (superseded UX-wise by this phase)
- [23-user-settings-and-spaces.md](../docs/23-user-settings-and-spaces.md) — Scope = workspace

---

## Mental model — what properties are and why they matter

### For the user

Properties are **structured labels on documents** in the current Scope. They answer questions like:

- *What stage is this?* (Status, Decision status)
- *What kind of work is this?* (Document type, Project)
- *When is it due / who cares?* (Due date, Stakeholders, Priority)
- *What is it about?* (Summary, Tags — often AI-suggested)

**Value:**

| Use | How properties help |
|-----|---------------------|
| **Orientation** | Open any doc → Properties tab shows consistent fields across the team |
| **Triage** | Filter "In review" + "High priority" across all docs in a scope |
| **AI context** | RAG and auto-fill use `summary`, `tags`, `document_type` to improve Insights and Ask |
| **Reporting** | Scope dashboard: how many experiments, how many drafts, which topics recur |
| **Handoff** | New member reads metadata before body text |

### In our logic (developer map)

```
metadata_schemas (per workspace / Scope)
        │
        ▼
documents.metadata.{field_key}  ◄── user edit (Properties tab)
        │                           ◄── AI auto-fill on save (Phase 07)
        │                           ◄── system keys (_ai_filled_keys, word_count)
        ▼
┌───────────────────┬────────────────────┬─────────────────────────┐
│ Insights / RAG    │ extract-document-  │ saved_views.filter_json │
│ (context quality) │ metadata job       │ (Phase 07b)             │
└───────────────────┴────────────────────┴─────────────────────────┘
        │
        ▼
Scope aggregates API — facet counts, topic rollups (Phase 07b)
```

**Scope** in the product UI = **workspace** in the database. Property definitions are **scope-wide**; values are **per document**. Library sources have a parallel `library_sources.metadata` path (P2 in this phase — document-first).

---

## UX redesign — Properties tab + **Properties Studio** (expanded sidebar)

### Concept: extended sidebar, not a modal

When the user clicks **Manage**, the right panel **expands leftward** over the document area — an **extended sidebar** (~960–1100px total width) instead of a centered modal or a narrow nested sheet.

| Mode | Width | What it covers |
|------|-------|----------------|
| Normal | `--panel-width-sm` (352px) | Standard Insights / Ask / Properties / Comments |
| **Manage** | `--panel-width-studio` (~1000px) | Slides left over the editor; document still visible underneath (dimmed) on the far left |

Animation: same easing as `right-panel--open`, width transition + optional scrim on the editor (`pointer-events: none` on doc while managing).

**Dismiss:** `Done` / `Back` / Escape → panel animates back to 352px; Properties tab unchanged.

This solves the modal-height problem by using **horizontal space** the editor already has, and keeps the **live Properties tab** visible while defining fields.

### Three-column layout (Manage mode)

```
┌─ Document (dimmed) ─────────────┬─ LEFT ────┬─ CENTER ──────────┬─ RIGHT ──────┐
│                                 │ Properties│ Property builder  │ Presets      │
│                                 │ tab       │                   │              │
│                                 │ (352px)   │ (flex, min 360px) │ (~280px)     │
│                                 │           │                   │              │
│                                 │ System    │ Name: [Review…]   │ ┌ Status ──┐ │
│                                 │ Created   │ Type: [cards]     │ │ Priority │ │
│                                 │           │ Options: chips    │ │ Doc type │ │
│                                 │ YOUR      │ Preview: toggle   │ │ Summary  │ │
│                                 │ PROPS     │ [Save property]   │ │ Tags     │ │
│                                 │ Status ▾  │                   │ └──────────┘ │
│                                 │ Priority  │ — or idle state:  │ click = add  │
│                                 │ …scroll   │ workspace schema  │              │
│                                 │           │ list + Remove     │ [Custom →]   │
│                                 │ Scope     │                   │              │
│                                 │ snapshot  │                   │              │
└─────────────────────────────────┴───────────┴───────────────────┴──────────────┘
```

#### Left column — **existing Properties tab** (unchanged role)

- Full current Properties tab UI: system rows, schema-driven value editors, scope snapshot.
- **Live preview:** when user adds a field in center/right, new row appears here immediately.
- User can **edit values on the open document** while configuring the workspace schema — validates that the builder preview matches reality.
- Fixed width: current `--panel-width-sm`; own vertical scroll.

#### Center column — **property builder + schema admin**

Two states:

| State | When | Content |
|-------|------|---------|
| **Idle** | Manage opens, no preset/builder selected | Workspace schema list: label, type, usage count, **Remove**; intro copy; **Build custom property** CTA |
| **Builder** | Custom CTA, or **Customize** on a preset | Wizard: Name → Type cards → Option chip editor → Live preview → Save |

- Builder preview uses the **same field renderers** as the left column.
- Saving returns to **Idle** (or keeps builder open for “add another”).
- This column gets the **most horizontal space** — room for type cards and option chips without vertical stacking hell.

#### Right column — **preset catalog**

- Scrollable list/grid of **predefined properties** (`PROPERTY_PRESETS` + icons).
- Each card: label, type hint, short description (e.g. *"Track document lifecycle"*).
- **Click preset** → add immediately to workspace schema (if not exists) + toast; new field appears in left column.
- **Customize** (secondary action on card) → loads preset into **center builder** for tweak before save.
- Disabled/“Already added” state when `field_key` exists.
- Optional filter/search at top if catalog grows.

### Normal Properties tab (before Manage)

```
┌─ Properties tab ─────────────────────────────┐
│ SYSTEM                                       │
│ Created · Created by · Word count            │
├──────────────────────────────────────────────┤
│ YOUR PROPERTIES                              │
│ Status           [ In progress ▾ ]           │
│ Priority         ( ) Low (•) Med ( ) High    │
│ Needs review     [====○    ] Yes             │
│ …scroll…                                     │
├──────────────────────────────────────────────┤
│ SCOPE SNAPSHOT               [All views →]   │
│ 12 docs · 4 in review · 3 experiments        │
├──────────────────────────────────────────────┤
│                        [ Manage properties ] │  ← pinned footer; enters Studio mode
└──────────────────────────────────────────────┘
```

- **Manage properties** expands the panel (not a modal).
- Empty state copy: *"Properties help you filter and understand documents in this scope."*

### Interactions summary

| User action | Result |
|-------------|--------|
| Click **Manage properties** | Panel expands to Studio; three columns shown |
| Click preset (right) | Schema created; field appears in left Properties tab |
| Click **Customize** on preset | Center builder pre-filled |
| **Build custom** (center idle) | Center → builder wizard |
| **Save** in builder | Schema created/updated; left tab refreshes; center → idle |
| **Remove** (center idle list) | Confirm + optional value purge |
| **Done** | Panel collapses to normal 352px sidebar |

### Why this layout works

| Goal | How |
|------|-----|
| No growing modal | Fixed viewport height; three columns scroll independently |
| Understand properties | Left tab shows real document values while you define fields |
| Fast path | Right presets = one click |
| Power path | Center builder = full control (radio, toggle, options) |
| Context | Still in editor; document dimmed but not navigated away |

### CSS / component notes

```css
/* tokens.css */
--panel-width-sm: 352px;
--panel-width-studio: 1000px;   /* or min(1000px, 55vw) */

.right-panel--studio {
  width: var(--panel-width-studio);
}
```

```
RightPanel
└── PropertiesTab
    ├── normal mode (single column)
    └── studio mode (PropertiesStudioLayout)
        ├── PropertiesTabColumn      ← left, reuses field list
        ├── PropertiesBuilderColumn  ← center
        └── PropertiesPresetColumn   ← right
```

Remove `PropertiesManageSheet` / centered `Modal` for Manage — replaced by `PropertiesStudioLayout`.

### Fix: modal getting taller

| Current (Phase 07) | Target (07b) |
|--------------------|--------------|
| Centered `Modal`; list ↔ form swap in one body | **Expanded sidebar**; three columns |
| Presets + list + form stack vertically | Presets **right**; builder **center**; values **left** |
| Type = long `Dropdown` | Type = **icon cards** in center column |
| Options = `<textarea rows={5}>` | **OptionChipEditor** in center column |

---

## Field types — schema and UI

### New / clarified types

| `field_type` | UI control | Value shape | Notes |
|--------------|------------|-------------|-------|
| `select` | Dropdown | `string` | Existing |
| `radio` | **Radio list** (vertical) | `string` | **New** — same storage as select; `display_as: "radio"` in schema options or distinct type |
| `checkbox` / `toggle` | **Toggle** (yes/no) | `boolean` | Rename label to "Yes/No"; never use dropdown for booleans |
| `multi_select` | Chip multi + dropdown | `string[]` | Chip editor for options in builder |
| … | (text, textarea, date, date_range, tags, number, url) | unchanged | Polish rendering |

**Migration `00020_metadata_field_display.sql` (if needed):**

```sql
-- Option A: add field_type 'radio'
-- Option B: metadata_schemas.options jsonb → { "values": [...], "display": "radio" }
```

Prefer **distinct `radio` type** for simpler Zod + UI branching.

### Presets catalog (expand)

Keep `PROPERTY_PRESETS`; add:

| Preset | Type | Notes |
|--------|------|-------|
| Needs review | `toggle` | Yes/No |
| Approved | `toggle` | Yes/No |
| Risk level | `radio` | low / medium / high |
| Audience | `multi_select` | internal, client, public |

Preset click = **immediate create** (no wizard) when preset is fully defined; toast + scroll to field in Properties tab.

---

## Scope property intelligence

### API `GET /api/workspaces/[id]/metadata-summary`

Returns aggregated picture for active scope:

```typescript
{
  document_count: number;
  facets: Record<string, { value: string; count: number }[]>; // per select/radio/multi field
  tags: { tag: string; count: number }[];
  ai_topics: { topic: string; count: number }[]; // from metadata.topics if present
  stale_review: number; // e.g. status=review AND updated_at > 14d ago
}
```

**UI — Scope snapshot** (bottom of Properties tab or collapsible section):

- Compact stats line
- Link **"Browse by property"** → opens Views picker

**UI — Scope properties panel** (optional stretch):

- Dedicated sub-view from Documents view header: heatmap or bar chart of Status / Document type counts
- Read-only in V1; no chart library requirement — horizontal bar rows are enough

### How user accesses scope properties

| Entry | Behavior |
|-------|----------|
| Properties tab → Scope snapshot | Facet summary for current scope |
| Documents view → **Views** dropdown | List saved views + "Browse metadata" |
| Scope switcher (future) | Badge: "4 need review" — Phase 08+ |

---

## Views foundation (V1)

Per [10-templates-and-views.md](../docs/10-templates-and-views.md) — implement minimal slice now so properties have *purpose*.

### Data model

Use existing `saved_views` table (or add migration if missing):

```sql
saved_views (
  id, workspace_id, name,
  filter_json jsonb,  -- e.g. { "metadata.status": "review" }
  sort_json jsonb,
  created_by, created_at
)
```

### API

```
GET    /api/saved-views?workspace_id=
POST   /api/saved-views
DELETE /api/saved-views/[id]
GET    /api/documents?workspace_id=&filter_json=  # extend list endpoint
```

### UI

1. **Documents view** — toolbar: `View: All documents ▾`
2. Built-in views: All, Drafts (metadata.status = draft), Recently updated
3. **Save current filters** — when user applies metadata chips, "Save as view…"
4. Clicking view applies filter to document list (client-side filter OK for V1 if &lt;500 docs)

### Metadata filter chips

When a view is active, show removable chips: `Status: review` `Type: experiment`.

---

## File checklist

```
apps/web/src/
├── components/
│   ├── RightPanel.tsx                 # studio width class when manage open
│   ├── RightPanel.css                 # --panel-width-studio, editor scrim
│   ├── PropertiesTab.tsx              # normal vs studio mode toggle
│   ├── properties/
│   │   ├── PropertiesStudioLayout.tsx # three-column shell
│   │   ├── PropertiesBuilderColumn.tsx
│   │   ├── PropertiesPresetColumn.tsx
│   │   ├── PropertyBuilderWizard.tsx
│   │   ├── PropertyTypePicker.tsx
│   │   ├── OptionChipEditor.tsx
│   │   ├── SchemaAdminList.tsx        # center idle: remove definitions
│   │   ├── ScopeMetadataSnapshot.tsx
│   │   ├── RadioField.tsx
│   │   └── ToggleField.tsx
│   └── views/
│       ├── SavedViewsMenu.tsx
│       └── MetadataFilterChips.tsx
├── app/api/
│   ├── workspaces/[id]/metadata-summary/route.ts
│   ├── saved-views/route.ts
│   └── saved-views/[id]/route.ts
├── hooks/
│   ├── useMetadataSchemas.ts          # extract from PropertiesTab if needed
│   ├── useScopeMetadataSummary.ts
│   └── useSavedViews.ts
└── lib/metadata/
    ├── schemas.ts                     # + radio type, toggle labels
    ├── presets.ts                     # expand presets
    └── filter-documents.ts            # apply filter_json client-side

packages/db/migrations/
└── 00020_metadata_radio_and_saved_views.sql   # if radio + saved_views not present

# Remove after studio ships:
# PropertiesManageSheet.tsx (centered modal)
```

---

## Step-by-step tasks

### 1. UX audit and freeze wireframes

- [ ] Record current Manage modal failure modes (height, lost context, add cancel confusion)
- [ ] Wireframe: sheet + wizard (attach to PR or `docs/` screenshot folder)
- [ ] Align with `TemplateDetailPanel` action bar pattern — reuse slide-over primitive from design system

### 2. Properties Studio — expanded sidebar shell

- [ ] `right-panel--studio` width token + transition (352px → ~1000px over editor)
- [ ] Editor scrim when studio open (dim + no pointer events on doc)
- [ ] `PropertiesStudioLayout` — three columns, independent scroll regions
- [ ] Header: "Manage properties" + **Done** (collapse panel)

### 3. Three columns

- [ ] **Left:** reuse Properties tab field list (live document values)
- [ ] **Center:** idle = `SchemaAdminList` (remove definitions); active = `PropertyBuilderWizard`
- [ ] **Right:** `PropertiesPresetColumn` — preset cards, one-click add + Customize

### 4. Property builder wizard (center column)

- [ ] `PropertyTypePicker` — cards with icon + short description
- [ ] `OptionChipEditor` — add/remove/reorder; validate min 2 options for radio/select
- [ ] Live preview row using same renderers as Properties tab
- [ ] Preset grid on first step of "Add"

### 4. Field renderers in Properties tab

- [ ] `RadioField` for `radio` (and optionally `select` with `display: radio`)
- [ ] `ToggleField` for boolean — label left, switch right
- [ ] AI-suggested hint styling (existing) on all types
- [ ] Inline **remove value** (clear) per field — not delete schema

### 5. Reliable add/remove schema

- [ ] `POST /api/metadata-schemas` — return created row; optimistic UI with rollback
- [ ] `DELETE` — show `documents_using_count` in confirm (query before delete)
- [ ] PATCH options (stretch) — edit options without deleting field
- [ ] Owner/admin gate; member can still edit values

### 6. Scope metadata summary

- [ ] Aggregation query (server): group by metadata keys defined in schema
- [ ] `ScopeMetadataSnapshot` in Properties tab
- [ ] Loading / empty states

### 7. Saved views V1

- [ ] Migration if `saved_views` missing
- [ ] CRUD API + RLS
- [ ] Documents view integration
- [ ] Built-in views seeded or hardcoded

### 8. In-product education

- [ ] Properties tab empty state copy
- [ ] Manage sheet intro: 2 sentences on scope-wide definitions
- [ ] Link to docs fragment `08-metadata-system.md` in help tooltip (optional)

### 9. AI + properties documentation pass

- [ ] Update `docs/08-metadata-system.md` — radio, toggle, scope summary, views
- [ ] Comment in `extract-document-metadata` job: which keys it reads/writes
- [ ] Note in Phase 08 plan: settings duplicate of Manage only

---

## Testing checklist

- [ ] Add property via preset → appears in tab without modal layout jump
- [ ] Add custom radio field with 3 options → renders as radio list in tab
- [ ] Add Yes/No toggle → renders as switch, stores boolean
- [ ] Remove property → confirm shows document count; values purged when selected
- [ ] Manage sheet height stable — studio height = viewport; columns scroll internally, not modal body
- [ ] Switch scope → Properties tab shows correct schema + snapshot for new workspace
- [ ] Save view "In review" → Documents list filters correctly
- [ ] AI auto-fill still respects user edits after field type changes
- [ ] 20 property limit enforced with clear error

---

## Exit criteria

1. User can **add and remove** properties through **Properties Studio** (expanded three-column sidebar).
2. **Presets** and **custom builder** both work; options edited via chip UI.
3. **Radio list** and **Yes/No toggle** are first-class field types.
4. User understands **why** properties exist (in-product copy + scope snapshot).
5. **Scope metadata summary** visible from Properties tab.
6. At least **one saved view** filterable by metadata works in Documents view.
7. Phase 08 can focus on settings/teams without re-solving Properties UX.

---

## Relationship to Phase 08

| Concern | Phase 07b | Phase 08 |
|---------|-----------|----------|
| Properties tab UX + builder | **Owner** | — |
| Manage entry in editor sidebar | **Owner** | Duplicate link in Settings → Space |
| Scope metadata summary | **Owner** | May extend in team settings |
| Saved views V1 | **Owner** | Polish + share views with team |
| Team invites, profile, billing | — | **Owner** |
| Document version history | — | **Owner** |

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Scope creep into full analytics dashboard | Scope snapshot = counts only; charts optional stretch |
| `saved_views` scope too large | Hard limit 10 views per workspace in V1 |
| Radio vs select duplication | Same storage; different renderer only |
| Migration pain for existing schemas | `checkbox` remains; UI changes to toggle automatically |

---

## Deliverables

- Refactored **Properties Studio** (expanded sidebar, three columns) — replaces Manage modal
- `radio` field type + `ToggleField` / `RadioField` components
- `GET /api/workspaces/[id]/metadata-summary`
- Saved views CRUD + Documents view filtering
- Updated metadata docs and preset catalog

**Merge:** PR `feature/phase-07b-properties` → `dev` when exit criteria met.
