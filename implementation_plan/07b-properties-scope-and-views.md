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
| **Manage modal grows without bound** | Replace with **in-context flyout**: Properties tab stays 352px; add/edit opens a temporary drawer (Notion/Figma pattern) |
| **Add/remove feels broken** | Users cannot confidently add, preview, reorder, or remove properties; error states and success feedback are unclear |
| **No mental model** | It is unclear *why* properties matter, what they power downstream, or how they relate to the active **Scope** (workspace) |
| **Limited field builder** | `select` uses a textarea for options; no radio list type; yes/no is a generic checkbox buried in a long type dropdown — not a first-class **toggle** |
| **No scope-level lens** | Properties are per-document only in the sidebar; there is no way to see patterns across documents in a scope (status distribution, topics, stale drafts) |
| **Views not started** | Saved filters / metadata-driven discovery deferred from 05c and 08 — users cannot *use* properties to find or group work |

Phase 07b makes properties **understandable, pleasant to define, and valuable to use** before Phase 08 adds settings, teams, and admin surfaces.

---

## Objectives

1. **Redesign Properties tab + property add flyout** — single panel for values + workspace schema; temporary drawer for presets/composer.
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

## UX redesign — Properties tab + **property add flyout**

> **Design gate:** [07b-ux-properties-studio.md](07b-ux-properties-studio.md) — flyout model (**D12**). **UI element definitions (flows a–d)** specify `PropertyAddFlyout`, `PropertyPickPanel`, `PropertyPresetRow`, composers, and chip editors. Implement per **D13**; compose controls per **D14**.

### Concept: flyout, not fullscreen studio

The Properties tab stays **352px**. Schema administration lives in the same tab (WORKSPACE PROPERTIES section). When the user taps **+ Add property**, a **320px flyout** slides in from the right — presets on top, custom/group creation at the bottom. The flyout transforms into the composer when needed; on Save it closes. **No Manage / Done mode.** App header and document canvas remain the focus.

| Surface | Width | Role |
|---------|-------|------|
| Properties panel | 352px | Document values + workspace schema list |
| Property add flyout | 320px | Temporary — pick preset or compose |

### Layout (default vs flyout open)

```
┌─ editor ─────────────┬─ Properties 352px ─┐     ┌─ editor ───┬─ Props ─┬─ Flyout ─┐
│                      │ THIS DOCUMENT     │     │            │ values  │ presets  │
│                      │ WORKSPACE PROPS   │     │            │ schema  │ or editor│
│                      │ [+ Add property]  │     │            │         │    [×]   │
└──────────────────────┴───────────────────┘     └────────────┴─────────┴──────────┘
```

#### Properties tab sections

| Section | Content |
|---------|---------|
| **SYSTEM** | Created, word count, etc. |
| **THIS DOCUMENT** | Interactive `SchemaFieldRow` values on open doc |
| **WORKSPACE PROPERTIES** | `PropertySchemaIndexRow` list — remove, edit opens flyout |
| **Footer** | `+ Add property` (primary) — opens flyout pick state |

#### Flyout states

| State | Content |
|-------|---------|
| **Pick** | Preset list (`props-list` previews) + footer: Create custom property / Create property group |
| **Compose** | Field or group composer + Save/Cancel |

### Interactions summary

| User action | Result |
|-------------|--------|
| **+ Add property** | Flyout opens — pick presets |
| Click preset **Add** | Schema created; flyout closes; rows update in tab |
| **Customize** on preset | Flyout → compose, pre-filled |
| **Create custom property** | Flyout → compose, empty |
| **Save** | Schema saved; flyout closes |
| **×** / `Escape` | Flyout closes |
| **Remove** (workspace list) | Confirm + purge optional |

### Why flyout beats 3-column studio

| Goal | How |
|------|-----|
| Clear mental model | One task at a time — document first, add is a side quest |
| No attention competition | Presets and editor never sit beside schema list permanently |
| Document focus | Canvas never covered by 100vw studio |
| Fast path | One-click preset add inside flyout |
| Power path | Same composer, inside flyout |

### CSS / component notes

```css
--panel-width-sm: 352px;
--panel-flyout-width: 320px;
```

```
RightPanel
└── PropertiesTab
    ├── document values (THIS DOCUMENT)
    ├── workspace schema (WORKSPACE PROPERTIES)
    ├── panel-actionbar (+ Add property)
    └── PropertyAddFlyout (conditional)
        ├── pick state (PropertyPresetRow list)
        └── compose state (PropertyFieldComposer | PropertyGroupComposer)
```

**Retire:** `PropertiesStudioLayout`, `right-panel--studio`, `Manage properties`, `Done`.

Remove `PropertiesManageSheet` / centered `Modal` for Manage — replaced by `PropertyAddFlyout`.

### Fix: modal getting taller

| Current (Phase 07) | Target (07b) |
|--------------------|--------------|
| Centered `Modal`; list ↔ form swap in one body | **Flyout drawer**; pick ↔ compose inside flyout |
| Presets + list + form stack vertically | Presets in flyout; schema list in tab; values in tab |
| Type = long `Dropdown` | Type = **icon cards** in flyout compose |
| Options = `<textarea rows={5}>` | **OptionChipEditor** in flyout compose |

---

## Property editor — types, builder, and groups

The **property add flyout** is where users create either a **single field** (one label → one value) or a **property group** (one section title → multiple sub-label + value rows).

### What users can create

#### Single fields (atomic properties)

Each field has one **label**, one **type**, and optional **options** (for choice types). Values are stored flat on `documents.metadata`.

| Category | `field_type` | Control in Properties tab | Value shape | Builder options |
|----------|--------------|---------------------------|-------------|-----------------|
| **Text** | `text` | Single-line input | `string` | — |
| | `textarea` | Multi-line input | `string` | — |
| | `url` | Input + link validation | `string` | — |
| **Numbers** | `number` | Numeric input | `number` | Unit suffix (optional, display-only: `%`, `€`, `days`) |
| **Choice** | `select` | Dropdown | `string` | Option chips |
| | `radio` | Vertical radio list | `string` | Option chips |
| | `multi_select` | Chip multi-select | `string[]` | Option chips |
| | `toggle` | Yes/No switch | `boolean` | Default on/off (replaces `checkbox` in UI) |
| **Dates** | `date` | Date picker | `string` (ISO) | — |
| | `date_range` | Start / end pickers | `{ start, end }` | — |
| **Organization** | `tags` | Tag chips + add | `string[]` | Suggested tags (optional) |

**Builder UX for single fields** (replaces current dropdown + textarea):

1. **Label** — e.g. "Review date"; auto key preview (`review_date`)
2. **Type** — compact **icon cards** grouped by category (not a long dropdown)
3. **Options** — `OptionChipEditor` when type is select / radio / multi_select
4. **Preview** — live row in left column using real field renderers
5. **Save** — primary small button

#### Property groups (composite + repeatable)

A **property group** is something the user **defines once** at workspace level:

1. **Name the group** — e.g. "KPI", "Experiment", "Review"
2. **Define sub-properties** — each row: sub-label + type (+ options / unit)

That definition is the **shape**. On each document, the user fills in **one or more instances** of that shape — repeatable blocks.

**Define once (flyout → Group compose):**

```
Group name     [ KPI                  ]

Sub-properties
│ Name             │ Text       │  [ − ]  │
│ Baseline         │ Number     │  [ − ]  │
│ Expected lift    │ Number  %  │  [ − ]  │
  [ + Add sub-property ]
               [ Save group ]
```

**Use on a document (Properties tab — left column):**

```
KPI                                    [ + Add KPI ]
┌─ KPI 1 ───────────────────────────────── [ Remove ]
│  Name            [ Revenue per seat     ]
│  Baseline        [ 1200                 ]
│  Expected lift   [ 15                   ]
└────────────────────────────────────────────────────
┌─ KPI 2 ───────────────────────────────── [ Remove ]
│  Name            [ Activation rate      ]
│  Baseline        [ 42                   ]
│  Expected lift   [ 8                    ]
└────────────────────────────────────────────────────
```

Same group definition, two **instances** on one document. The user does **not** need separate "Primary KPI" and "Secondary KPI" group types — they add another block.

For groups that are naturally singular (e.g. **Review**), the UI still uses the same model but starts with **one instance** and hides **+ Add** unless the workspace owner marked the group as repeatable (default: **repeatable = true**; owner can turn off for Review-style groups).

**Example — Experiment** (preset group, one instance typical):

```
EXPERIMENT
  Hypothesis      [ We believe…          ]   textarea
  Outcome         ( ) Pending (•) Success    radio
  Confidence      [====○    ] High           toggle
```

### Mental model — definition vs instance

| Layer | Who sets it | Where | What |
|-------|-------------|-------|------|
| **Group definition** | Workspace admin | Properties Studio | Group name + sub-property schema |
| **Group instance** | Anyone editing a doc | Properties tab | One filled-in block (values for each sub-property) |
| **Single field** | Workspace admin | Properties Studio | One label + type; one value per document |

```
Workspace                          Document metadata
─────────                          ─────────────────
metadata_schema_groups             metadata.kpi = [
  KPI (repeatable)                   { name, baseline, expected_lift },  ← instance 1
metadata_schemas (children)          { name, baseline, expected_lift },  ← instance 2
  name: text                       ]
  baseline: number
  expected_lift: number
```

### Field keys — definition uses relative sub-keys

Sub-properties inside a group use a **relative `sub_key`** (not a workspace-global `field_key`):

```
group_label: "KPI"           →  group_key: kpi
sub_label:   "Expected lift" →  sub_key: expected_lift
sub_label:   "Name"          →  sub_key: name
```

Instance values live under `metadata[group_key]` as an **array of objects** keyed by `sub_key`:

```json
{
  "kpi": [
    { "name": "Revenue per seat", "baseline": 1200, "expected_lift": 15 },
    { "name": "Activation rate", "baseline": 42, "expected_lift": 8 }
  ],
  "status": "in_progress"
}
```

Single fields stay flat at the top level (`status`, `due_date`, …). Group data is namespaced by `group_key` so instances never collide.

**Why arrays:** Matches repeatable blocks, keeps instance boundaries clear, and avoids encoding instance index in flat keys (`kpi_0_name`, `kpi_1_name`).

**Filters / views / RAG:** Query with JSON path (e.g. `metadata->kpi @> '[{"baseline": 1200}]'` or app-layer facet). Acceptable tradeoff for correct UX.

### Data model

**Migration `00020_metadata_schema_groups.sql`:**

```sql
create table metadata_schema_groups (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  group_key text not null,
  group_label text not null,
  repeatable boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now() not null,
  unique (workspace_id, group_key)
);

alter table metadata_schemas
  add column group_id uuid references metadata_schema_groups(id) on delete cascade,
  add column sub_key text,           -- relative key within group; null for ungrouped fields
  add column sort_order int not null default 0;

-- Ungrouped fields: field_key required, sub_key null
-- Group sub-fields: sub_key required, field_key = group_key || '_' || sub_key (denormalized for migrations) OR generated only in API
```

| Layer | Table | Notes |
|-------|-------|-------|
| Group definition | `metadata_schema_groups` | `group_label`, `group_key`, `repeatable` |
| Sub-property def | `metadata_schemas` | `group_id` + `sub_key` + `field_type` + `options` |
| Instance values | `documents.metadata[group_key]` | `Array<Record<sub_key, value>>` |
| Single field values | `documents.metadata[field_key]` | Scalar / array per type |

**Limits:** Sub-properties count toward `MAX_METADATA_SCHEMAS_PER_WORKSPACE` (a KPI group with 3 sub-properties = 3). Group definitions themselves do not.

**Instance limits (V1):** Max 10 instances per group per document (configurable constant).

### Builder UX — two modes

At the top of the center column when editor is active:

```
[ Field ]  [ Group ]     ← segmented control, small secondary/ghost
```

#### Mode: Field (default)

Triggered by **+ Add property** or preset **Customize** on a single-field preset.

```
Label          [ Review date          ]
Type           [ Text ] [ Number ] [ Select ] …   ← icon cards
Options        (chip editor if choice type)
Preview        (inline, optional)
               [ Cancel ]  [ Save property ]
```

#### Mode: Group

Triggered by **+ Add property → Group** tab, or preset **Customize** on a group preset (e.g. "KPI").

```
Group name     [ KPI                  ]
☑ Allow multiple on a document        ← repeatable (default on)

Sub-properties
┌──────────────────┬────────────┬─────────┐
│ Name             │ Text       │  [ − ]  │
│ Baseline         │ Number     │  [ − ]  │
│ Expected lift    │ Number  %  │  [ − ]  │
└──────────────────┴────────────┴─────────┘
  [ + Add sub-property ]

Preview        (one instance block in left column)
               [ Cancel ]  [ Save group ]
```

**Sub-property row:** sub-label input · compact type picker · optional unit suffix for numbers · ghost Remove.

**Allowed sub-property types:** text, textarea, number, select, radio, multi_select, toggle, date, tags, url. No nested groups in V1.

**Save group** = one API call: create `metadata_schema_groups` + all child `metadata_schemas` rows.

### Presets — single and group

Right column shows two sections (or visual separator):

**Quick fields** — existing `PROPERTY_PRESETS` (Status, Priority, …)

**Group templates** — new `PROPERTY_GROUP_PRESETS`:

| Group preset | Sub-fields |
|--------------|------------|
| **KPI** | Name (text), Baseline (number), Expected lift (number, `%`) — repeatable |
| **Experiment** | Hypothesis (textarea), Outcome (radio), Confidence (radio) — single instance |
| **Review** | Reviewer (text), Review date (date), Approved (toggle) — single instance |
| **Decision** | Status (select), Stakeholders (tags), Deadline (date) — single instance |

Card actions unchanged: **Add** (instant) / **Customize** (opens group builder pre-filled).

### Properties tab rendering

Order: system rows → **ungrouped fields** → **groups** (each group renders instances).

```tsx
// Pseudocode — repeatable group
{groups.map(group => {
  const instances = readGroupInstances(metadata, group.group_key); // default [{},] if empty
  return (
    <section className="props-list__section">
      <div className="props-group__header">
        <h3 className="props-list__section-title">{group.group_label}</h3>
        {group.repeatable && (
          <Button size="small" variant="ghost" onClick={() => addInstance(group)}>
            + Add {group.group_label}
          </Button>
        )}
      </div>
      {instances.map((instance, index) => (
        <div key={index} className="props-group__instance">
          {group.repeatable && instances.length > 1 && (
            <Button size="small" variant="ghost" onClick={() => removeInstance(group, index)}>
              Remove
            </Button>
          )}
          {group.fields.map(field => (
            <SchemaFieldRow
              variant="grouped"
              value={instance[field.sub_key]}
              onChange={(v) => setInstanceValue(group, index, field.sub_key, v)}
            />
          ))}
        </div>
      ))}
    </section>
  );
})}
```

Each **instance** is a subtle card (`border`, `radius-md`) so repeatable blocks are visually distinct. Singular groups (Review) show one card without **+ Add**.

### Field types — schema additions

| `field_type` | UI control | Value shape | Notes |
|--------------|------------|-------------|-------|
| `select` | Dropdown | `string` | Existing |
| `radio` | Radio list (vertical) | `string` | **New** — distinct type |
| `checkbox` → `toggle` | Yes/No switch | `boolean` | UI label "Yes/No"; keep `checkbox` in DB or alias |
| `multi_select` | Chip multi | `string[]` | Option chips in builder |
| `number` | Numeric input | `number` | Optional `options: { unit: "%" }` for display |
| … | text, textarea, date, date_range, tags, url | unchanged | |

**Migration `00021_metadata_field_radio.sql`:** add `radio` to `field_type` check; optionally rename checkbox display to toggle in UI only.

### Phase split

| Slice | Deliverable |
|-------|-------------|
| **07b.1** (current) | Studio layout, flat fields, presets, type icon cards, OptionChipEditor |
| **07b.2** | Groups migration, group builder (name + sub-properties), repeatable instance UI, group presets (KPI, …) |
| **07b.3** | `radio` / `toggle` types, scope snapshot, saved views V1 |

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
