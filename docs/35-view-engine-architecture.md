# 35 — View Engine architecture

**Status:** All seven base view types (Kanban, Dashboard, Calendar, Mind-Map, Knowledge Graph, Roadmap/Gantt, Wiki) are shipped.

Generic, metadata-driven view engine: one renderer per base type, configured against whatever metadata fields exist in a workspace. No persona-specific dashboards or boards.

## Base view types

| ID | Label | Interaction | Persistence |
|----|-------|-------------|-------------|
| `kanban` | Kanban | Editable columns from `status`/`select` | Document metadata |
| `dashboard` | Dashboard | Read widgets (count/sum/avg/min/max, breakdown, trend, list) — editable widget builder | Widget config on instance (`config.widgets`) |
| `gantt` | Roadmap / Gantt | DnD bars, multi-level hierarchy | Document date (+ hierarchy) fields |
| `calendar` | Calendar | Plot by date; month grid or agenda list; optional date-range window; writers can delete tabs (last tab protected) | Document date fields |
| `mindmap` | Mind-Map | Tree authoring: guided root, add/delete docs, reconnect = reparent | `layout` v2 on instance + Origin (optional config relation) |
| `graph` | Knowledge Graph | Read-only 3D exploration (one graph per scope) | Derived from `relation` fields |
| `wiki` | Wiki | Left page tree + full document editor; Spaces as tabs | Origin parent links + `layout.order` sibling order |

`mindmap`, `graph`, and `wiki` are **different tools**. Mind-Map authors a spatial document tree on `@xyflow/react`. Knowledge Graph is a **read-only 3D** explorer on `react-force-graph-3d`. Wiki is an **outline reading/writing** surface: Space tabs (root docs), nested pages via Origin, sibling order in instance `layout`, center pane embeds the full document editor (`EmbeddedDocumentEditor` / same session as `/editor`) with the template picker on create.

**ADR 006 note:** Wiki’s left tree is **view-local chrome** on `/wiki` only. The global Documents list stays flat/search — no permanent app-wide file tree.

## Data model: `scope_view_instances`

**Nav / tier limits** count **page types** only (`enabled_views`: Kanban, Dashboard, Mind-Map, …). Each page can host many **in-page tabs** — one row per board/setup in `scope_view_instances` for that `base_view_type`. Tier caps do **not** count tabs.

Bundle `ViewPreset`s seed predefined tabs on the matching page (e.g. Experiment board → Kanban tab; Funnel dashboard → Dashboard tab). The live source of truth is the instance, not the preset. Enabling a page type with no presets seeds one default instance so the tab bar is never empty.

| Column | Notes |
|--------|-------|
| `workspace_id` | Scope owner |
| `base_view_type` | Catalog id (`kanban`, `mindmap`, `graph`, …) — many rows allowed per type |
| `label` | Tab title |
| `config` | Typed JSON per base type (see shared `view-engine` types) |
| `layout` | Nullable; Mind-Map **v2**: `{ v: 2, rootId, nodes: { [nodeId]: { x, y, parentId, documentId } } }`. Legacy v1 `{ [document_id]: { x, y } }` is normalized on read. Placeholder roots use local ids (`local:…`) with `documentId: null` until a template is chosen — no ghost DB docs. |
| `created_from_preset_id` | Bundle preset id when seeded |
| `position` | Tab order (reorder UI deferred) |

On scope create / composition apply, one row is upserted per selected `viewPresetId`, plus a default row for any enabled base type that still has zero instances. Users add/remove tabs via the in-page `ViewInstanceTabBar` (`+` / confirm delete); the last tab of an enabled page type cannot be deleted.

Active tab is persisted per scope + base type in local storage (`rhodes:view-instance:{workspaceId}:{baseViewType}`).

## Typed `config` (shared package)

- **Kanban** — `groupByField`, optional `cardFields`, `sortBy`
- **Dashboard** — `widgets[]` (`stat` \| `breakdown` \| `trend` \| `list`)
- **Gantt** — `startField`, optional `endField` / `durationField`, `hierarchyFields[]`, optional `colorByField`
- **Calendar** — `dateField`, optional `colorByField`
- **Mind-Map** — optional `nodeLabelField`, `colorByField`, `defaultTemplateSlug`
- **Knowledge Graph** — optional `relationFields`, `nodeLabelField`, `showCommunities`, `showLibraryNodes` (default on), `minDegreeHighlight`
- **Wiki** — optional `rootDocumentId`, `relationField` (default Origin), `defaultTemplateSlug` (picker highlight only)

Wiki `layout` (instance column): `{ v: 1, order: { [parentId]: childIds[] } }` for sibling display order — accepted by `viewInstanceLayoutSchema` and persisted on the view instance. Hierarchy edges are Origin (or configured relation) on each child document. In Wiki, Origin is **read-only in Properties** — reparent by dragging in the page tree. Clearing Origin would drop the page out of the Space tree. Reparent PATCHes document metadata and notifies the open editor session so Origin updates immediately.

Field pickers only offer schema fields of the compatible `field_type`.

## Dashboard aggregation API (shipped)

`POST /app/api/scopes/:workspaceId/dashboard-query`

Accepts a `{ widgets: DashboardWidget[] }` body. Every widget's `field`, `groupByField`, and `filter.field` are allowlisted against that workspace's `metadata_schemas` before use (400 on an unknown key). The route then fetches the workspace's active (non-archived, non-draft) document rows (`id, title, metadata`) and computes each widget's aggregation in-process via `computeAllWidgetResults` (`apps/web/src/lib/views/dashboard.ts`) — count/sum/avg/min/max, optionally grouped, plus month-bucketed trends and top-N lists. This keeps the allowlisting logic and the query itself simple; move to real Postgres aggregate queries (`documents.metadata->>'field_key'`) if per-workspace document counts make in-process aggregation slow.

Widget config is persisted on the active `dashboard` `scope_view_instances` tab's `config.widgets`, edited via `PATCH /app/api/workspaces/:id/view-instances/:instanceId` (falls back to `POST /app/api/workspaces/:id/view-instances` to create a row if needed). Multiple dashboard tabs are supported; each has its own widgets.

## Rendering stack (confirmed)

| View | Library |
|------|---------|
| Kanban | `@dnd-kit/core` |
| Dashboard | `recharts` (already installed) |
| Gantt | `@svar-ui/react-gantt` (MIT core; PRO deferred) — nested summary rows built client-side from `hierarchyFields` (`apps/web/src/lib/views/gantt.ts`) |
| Calendar | custom + `date-fns` |
| Mind-Map | `@xyflow/react` + butterfly packer (`mindmap-layout.ts`); `MindMapNode` (`DocumentCard` + IconButtons); shared `ViewDocumentPanel` for guided root / edit; full-page editor remains an escape hatch |
| Knowledge Graph | `react-force-graph-3d` (Three.js); degree hub sizing, search + `zoomToFit`, **community detection + legend** (synchronous label propagation, not Louvain/Leiden), ego-network highlight on select, read-only `ViewDocumentPanel` (`viewing`) then Open full page → editor; **library source nodes** (teal, default on) + **citation edges** from TipTap `citation` nodes (`lib/views/citation-graph.ts`) |

Gantt collision detection flags leaf tasks whose date span overlaps a sibling under the same summary row (`markCollisions` in `gantt.ts`) — rendered via a custom `collision` task type/CSS class on top of SVAR's `taskTypes`, since SVAR itself doesn't model resource/date conflicts. When `endField` is unset, Gantt derives bar end from `planned_duration_days` (or configured `durationField`) as `start + days`.

**Mind-Map vs Knowledge Graph (do not conflate):**

| | Mind-Map | Knowledge Graph |
|--|----------|-----------------|
| Canvas | `@xyflow/react` (2D) | `react-force-graph-3d` (Three.js) |
| Node UI | `DocumentCard` via `components/mindmap/MindMapNode.tsx` (same surface as Kanban) | Force-graph spheres (`components/graph/KnowledgeGraph3D.tsx`); community colors from `paletteColor`; library nodes use a fixed teal |
| Structure | Explicit tree in `layout` (`parentId` / `documentId`) | Document↔document from `relation` fields; document→library from TipTap citations; all library files in scope as nodes (isolates allowed) |
| Layout | Butterfly pack after add / delete / reparent; drag persists | Live 3D force simulation (orbit / zoom / pan) |
| Mutations | Create Blank children, delete docs, reconnect edge = reparent | Explore-only: select doc → ego highlight + read-only panel; select library → file preview |

Shared helpers: **relation-field edges** in `apps/web/src/lib/views/relation-graph.ts`; **citation edges** in `apps/web/src/lib/views/citation-graph.ts` (chunk→source via `POST /app/api/library/resolve`). Mind-Map tree helpers: `apps/web/src/lib/views/mindmap.ts` + `mindmap-layout.ts`.

### In-context document panel

Kanban, Calendar, Mind-Map, and Roadmap/Gantt open/create documents in a shared `ViewDocumentPanel` (docked right) instead of navigating to `/editor` by default. Knowledge Graph uses the same panel in **`viewing`** mode (TipTap `editable={false}`, connections list, Open full page → editor):

1. **Create** → template picker (affinity-suggested templates first) → `createDocument` with optional seed metadata → lean TipTap editor in the panel.
2. **Open / edit** → load title + content + Origin in the panel; **Open full page** remains available.
3. **View** (Knowledge Graph) → same chrome, read-only body; click a connection to jump nodes (library connections open preview).
4. Seeded create contexts: Kanban column status/select; Calendar day date/`date_range`; Gantt today’s start (and end) date fields; Mind-Map **guided root** opens the template picker on an unfinished placeholder (no DB doc until pick); **+** creates a Blank child under a real parent, pre-fills **Origin**, inserts into layout, and mild-reflows (also writes the configured link relation when it is not Origin). Live title edits update the card label via `onDocumentTitleChange`.

### Universal Origin relation

Every system template (including Blank) carries an essential `origin` relation field (`field_key: origin`, AI fill off). Scopes seed the schema field so any document can optionally link to a parent/source document. Relation search is scope-local for private/team scopes and org-wide (membership-constrained) for org workspaces.

Mind-Map hierarchy is owned by layout `parentId`. Document links prefer Origin on the child; an optional dedicated relation (`resolveMindMapRelationField`) can also be written on the parent when configured.

## Rollout order

Actual ship order reprioritized Calendar ahead of Roadmap/Gantt (zero new dependencies, lowest risk) to build view breadth faster; Mind-Map shipped on React Flow; Knowledge Graph later moved to 3D force-graph explore; Gantt ships last since it's the heaviest new dependency (`@svar-ui/react-gantt`) and the most novel domain logic (collision detection).

1. Foundations (this doc, types, catalog split, table, seed) — done
2. Kanban — available (DnD board grouped by status/select metadata)
3. Dashboard — available (widget builder + aggregation API, `recharts` rendering)
4. Calendar — available (custom month grid + `date-fns`, day buckets from `date`/`date_range` fields)
5. Mind-Map — available (`@xyflow/react` + butterfly layout v2 / guided root, `DocumentCard` nodes, reconnect = reparent)
6. Knowledge Graph — available (`react-force-graph-3d`, hub sizing, communities, library nodes + citation edges, search/`zoomToFit`, ego highlight, read-only document panel)
7. Roadmap / Gantt — available (`@svar-ui/react-gantt`, client-built hierarchy + sibling collision highlighting; duration-field end derivation)

## Related

- [29-use-cases-views-templates.md](29-use-cases-views-templates.md) — catalog + presets principle
- [31-scope-bundles-catalog.md](31-scope-bundles-catalog.md) — bundles that seed presets
- [37-cross-surface-collab-uat.md](37-cross-surface-collab-uat.md) — Wiki ↔ editor collab UAT
- Shared types: `packages/shared/src/view-engine.ts`, `packages/shared/src/scope-views.ts`
