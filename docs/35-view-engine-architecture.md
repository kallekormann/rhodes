# 35 — View Engine architecture

**Status:** All six base view types (Kanban, Dashboard, Calendar, Mind-Map, Knowledge Graph, Roadmap/Gantt) are shipped. `wiki` remains a separate legacy catalog entry, unimplemented.

Generic, metadata-driven view engine: one renderer per base type, configured against whatever metadata fields exist in a workspace. No persona-specific dashboards or boards.

## Base view types

| ID | Label | Interaction | Persistence |
|----|-------|-------------|-------------|
| `kanban` | Kanban | Editable columns from `status`/`select` | Document metadata |
| `dashboard` | Dashboard | Read widgets (count/sum/avg/min/max, breakdown, trend, list) — editable widget builder | Widget config on instance (`config.widgets`) |
| `gantt` | Roadmap / Gantt | DnD bars, multi-level hierarchy | Document date (+ hierarchy) fields |
| `calendar` | Calendar | Plot by date; month grid or agenda list; optional date-range window; writers can delete tabs (last tab protected) | Document date fields |
| `mindmap` | Mind-Map | Authoring: place nodes, draw edges | `layout` on instance + `relation` values |
| `graph` | Knowledge Graph | Read-only exploration (graphify-like) | Derived from `relation` fields |
| `wiki` | Wiki / links | Doc graph (existing catalog entry) | — |

`mindmap` and `graph` are **different tools** that share React Flow primitives. Connections are always `relation` field values on documents; Mind-Map additionally persists node positions in `scope_view_instances.layout`.

## Data model: `scope_view_instances`

**Nav / tier limits** count **page types** only (`enabled_views`: Kanban, Dashboard, Mind-Map, …). Each page can host many **in-page tabs** — one row per board/setup in `scope_view_instances` for that `base_view_type`. Tier caps do **not** count tabs.

Bundle `ViewPreset`s seed predefined tabs on the matching page (e.g. Experiment board → Kanban tab; Funnel dashboard → Dashboard tab). The live source of truth is the instance, not the preset. Enabling a page type with no presets seeds one default instance so the tab bar is never empty.

| Column | Notes |
|--------|-------|
| `workspace_id` | Scope owner |
| `base_view_type` | Catalog id (`kanban`, `mindmap`, `graph`, …) — many rows allowed per type |
| `label` | Tab title |
| `config` | Typed JSON per base type (see shared `view-engine` types) |
| `layout` | Nullable; Mind-Map node positions `{ [document_id]: { x, y } }` |
| `created_from_preset_id` | Bundle preset id when seeded |
| `position` | Tab order (reorder UI deferred) |

On scope create / composition apply, one row is upserted per selected `viewPresetId`, plus a default row for any enabled base type that still has zero instances. Users add/remove tabs via the in-page `ViewInstanceTabBar` (`+` / confirm delete); the last tab of an enabled page type cannot be deleted.

Active tab is persisted per scope + base type in local storage (`rhodes:view-instance:{workspaceId}:{baseViewType}`).

## Typed `config` (shared package)

- **Kanban** — `groupByField`, optional `cardFields`, `sortBy`
- **Dashboard** — `widgets[]` (`stat` \| `breakdown` \| `trend` \| `list`)
- **Gantt** — `startField`, optional `endField`, `hierarchyFields[]`, optional `colorByField`
- **Calendar** — `dateField`, optional `colorByField`
- **Mind-Map** — optional `nodeLabelField`, `colorByField`, `defaultTemplateSlug`
- **Knowledge Graph** — optional `relationFields`, `nodeLabelField`, `showCommunities`, `minDegreeHighlight`

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
| Mind-Map | `@xyflow/react`; lightweight custom sidebar (title + excerpt + "Open full page"), not the full `RightPanel`/`useEditorSession` stack — revisit if inline editing becomes a priority |
| Knowledge Graph | `@xyflow/react` + `d3-force`; degree sizing, search, **community detection + legend in v1** (synchronous label propagation, not Louvain/Leiden), explain panel then navigate |

Gantt collision detection flags leaf tasks whose date span overlaps a sibling under the same summary row (`markCollisions` in `gantt.ts`) — rendered via a custom `collision` task type/CSS class on top of SVAR's `taskTypes`, since SVAR itself doesn't model resource/date conflicts.

Both `MindMapView` and `KnowledgeGraphView` share `apps/web/src/components/graph/DocumentNode.tsx` (the React Flow node renderer + color palette) and `apps/web/src/lib/views/relation-graph.ts` (relation-field edge derivation, degree counts, community detection). Knowledge Graph additionally uses `apps/web/src/lib/views/force-layout.ts` (`d3-force`, run to completion once per data change — no live ticking since the view is read-only/derived).

Mind-Map connections currently always write to the **first** `relation`-type schema field found in the workspace (there's no per-connection field picker yet); if no relation field exists, connecting is blocked with a toast pointing at Settings. Revisit if scopes need multiple distinct relation fields addressable from the canvas.

## Rollout order

Actual ship order reprioritized Calendar ahead of Roadmap/Gantt (zero new dependencies, lowest risk) to build view breadth faster; Mind-Map and Knowledge Graph shipped together since both share React Flow node-link primitives; Gantt ships last since it's the heaviest new dependency (`@svar-ui/react-gantt`) and the most novel domain logic (collision detection).

1. Foundations (this doc, types, catalog split, table, seed) — done
2. Kanban — available (DnD board grouped by status/select metadata)
3. Dashboard — available (widget builder + aggregation API, `recharts` rendering)
4. Calendar — available (custom month grid + `date-fns`, day buckets from `date`/`date_range` fields)
5. Mind-Map — available (`@xyflow/react` canvas, persisted `layout`, connections write `relation` values)
6. Knowledge Graph — available (`@xyflow/react` + `d3-force`, degree sizing, community legend, search, explain panel)
7. Roadmap / Gantt — available (`@svar-ui/react-gantt`, client-built hierarchy + sibling collision highlighting)

## Related

- [29-use-cases-views-templates.md](29-use-cases-views-templates.md) — catalog + presets principle
- [31-scope-bundles-catalog.md](31-scope-bundles-catalog.md) — bundles that seed presets
- Shared types: `packages/shared/src/view-engine.ts`, `packages/shared/src/scope-views.ts`
