# 35 — View Engine architecture

**Status:** agreed (foundations shipping)

Generic, metadata-driven view engine: one renderer per base type, configured against whatever metadata fields exist in a workspace. No persona-specific dashboards or boards.

## Base view types

| ID | Label | Interaction | Persistence |
|----|-------|-------------|-------------|
| `kanban` | Kanban | Editable columns from `status`/`select` | Document metadata |
| `dashboard` | Dashboard | Read widgets (count/sum/avg) | Widget config on instance |
| `gantt` | Roadmap / Gantt | DnD bars, multi-level hierarchy | Document date (+ hierarchy) fields |
| `calendar` | Calendar | Plot by date | Document date fields |
| `mindmap` | Mind-Map | Authoring: place nodes, draw edges | `layout` on instance + `relation` values |
| `graph` | Knowledge Graph | Read-only exploration (graphify-like) | Derived from `relation` fields |
| `wiki` | Wiki / links | Doc graph (existing catalog entry) | — |

`mindmap` and `graph` are **different tools** that share React Flow primitives. Connections are always `relation` field values on documents; Mind-Map additionally persists node positions in `scope_view_instances.layout`.

## Data model: `scope_view_instances`

Bundle `ViewPreset`s seed per-scope rows; the live source of truth is the instance, not the preset.

| Column | Notes |
|--------|-------|
| `workspace_id` | Scope owner |
| `base_view_type` | Catalog id (`kanban`, `mindmap`, `graph`, …) |
| `label` | User-visible name |
| `config` | Typed JSON per base type (see shared `view-engine` types) |
| `layout` | Nullable; Mind-Map node positions `{ [document_id]: { x, y } }` |
| `created_from_preset_id` | Bundle preset id when seeded |
| `position` | Nav / settings order |

On scope create / composition apply, one row is inserted per selected `viewPresetId` (config copied from the preset). Users can later edit config or add more instances of the same base type from Settings.

## Typed `config` (shared package)

- **Kanban** — `groupByField`, optional `cardFields`, `sortBy`
- **Dashboard** — `widgets[]` (`stat` \| `breakdown` \| `trend` \| `list`)
- **Gantt** — `startField`, optional `endField`, `hierarchyFields[]`, optional `colorByField`
- **Calendar** — `dateField`, optional `colorByField`
- **Mind-Map** — optional `nodeLabelField`, `colorByField`, `defaultTemplateSlug`
- **Knowledge Graph** — optional `relationFields`, `nodeLabelField`, `showCommunities`, `minDegreeHighlight`

Field pickers only offer schema fields of the compatible `field_type`.

## Dashboard aggregation API

`POST /app/api/scopes/:workspaceId/dashboard-query`

Accepts widget specs; allowlists every field key against that workspace’s `metadata_schemas`; runs Postgres aggregates over `documents.metadata`. Not folded into `/app/api/documents`.

## Rendering stack (confirmed)

| View | Library |
|------|---------|
| Kanban | `@dnd-kit/core` |
| Dashboard | `recharts` (already installed) |
| Gantt | `@svar-ui/react-gantt` (MIT core; PRO deferred) |
| Calendar | custom + `date-fns` |
| Mind-Map | `@xyflow/react`; sidebar editor via `RightPanel` / `useEditorSession`; “Open full page” escape hatch |
| Knowledge Graph | `@xyflow/react` + `d3-force`; degree sizing, search, **community detection + legend in v1**, explain panel then navigate |

Gantt collision detection (overlapping bars under the same hierarchy row) is custom domain logic on top of SVAR.

## Rollout order

1. Foundations (this doc, types, catalog split, table, seed) — current
2. Kanban
3. Dashboard (+ aggregation API)
4. Roadmap / Gantt
5. Calendar
6. Mind-Map
7. Knowledge Graph

## Related

- [29-use-cases-views-templates.md](29-use-cases-views-templates.md) — catalog + presets principle
- [31-scope-bundles-catalog.md](31-scope-bundles-catalog.md) — bundles that seed presets
- Shared types: `packages/shared/src/view-engine.ts`, `packages/shared/src/scope-views.ts`
