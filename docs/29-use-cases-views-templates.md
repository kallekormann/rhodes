# 29 — Use cases, scope views & template bundles

**Status:** draft (M2 Wave 0)

## Context

Each scope enables **essential views** (always on) plus **additional views** (tier-limited). Templates are recommended per view bundle at scope creation. Catalog entries can ship as `coming_soon` until M6 implements the surface.

## Essential views (always enabled)

| ID | Label | Notes |
|----|-------|-------|
| `documents` | Documents | List + shared-with-us (team scopes) |
| `editor` | Editor | TipTap |
| `templates` | Templates | Scope templates |
| `library` | Library | RAG sources |
| `settings` | Settings | Scope + sharing policies |

Defined in [`packages/shared/src/scope-views.ts`](../packages/shared/src/scope-views.ts) as `ESSENTIAL_SCOPE_VIEW_IDS`.

## Additional view catalog (M2 seed)

Populate `ADDITIONAL_SCOPE_VIEW_CATALOG` incrementally. M2 ships catalog metadata only; UI shows `coming_soon` until M6.

| ID | Label | min tier | Status | Use case |
|----|-------|----------|--------|----------|
| `kanban` | Kanban | basic | **available** | Task boards per project |
| `calendar` | Calendar | basic | **available** | Deadlines, publishing schedule |
| `mindmap` | Mind-Map | pro | **available** | Author a map of documents; connections become relations |
| `graph` | Knowledge Graph | pro | **available** | Explore relation-linked documents across the scope |
| `gantt` | Gantt | pro | **available** | Long-form planning |
| `wiki` | Wiki | basic | **available** | Spaces + page tree + full editor |
| `dashboard` | Dashboard | pro | **available** | Scope metrics |

Tier limits (`maxAdditionalScopeViews`): free 1, basic 3, pro 5, team 5.

Architecture for renderers, `ScopeViewInstance`, and typed configs: [35-view-engine-architecture.md](35-view-engine-architecture.md).

### Design principle: presets, not new engines

"Ticketing system," "JIRA clone," "Discovery matrix," "Freshness radar," and "Sprint board" are **not**
separate base view types — each is a `ViewPreset` (see `packages/shared/src/scope-bundles.ts`) that
configures one of the base engines above against a bundle's own metadata fields (e.g. Kanban grouped by
a `status` field's category, or Calendar plotting a `date`/`date_range` field). New use cases should add a
`ViewPreset`, not a new `AdditionalScopeViewId`, unless the rendering model is genuinely different from
every existing base type.

### KPI Tree (post-M6)

A North-Star-metric-down-to-drivers tree (see metric tree / semantic layer practice) requires aggregating
a `number` field's values **across many documents**, not just displaying one document's fields — a materially
harder problem than any view above (it needs a rollup/aggregation layer, not just a config slot). Treat this
as a `dashboard` v2 concept once the Mind-Map / Knowledge Graph foundation and a real M6 rendering engine exist;
do not attempt to seed it as a bundle view preset yet.

## Template bundles (wizard pre-check)

When a user selects additional **page types** at scope creation, the wizard adds
recommended templates for those views. Removing a page type removes those
templates (unless another selected view or bundle still needs them). Preset boards
are **not** selectable views — they ship with bundles as tabs on a page type.
Picking templates alone does **not** force-enable page types. System templates from
seed migrations apply when `workspace_id` is null. The header **+** always creates
via the Blank system template (which includes the universal **Origin** relation).
Every system template carries Origin so documents can optionally link to a parent
document. Kanban, Calendar, Mind-Map, and Roadmap/Gantt create/open documents in a
sidebar panel with a template picker rather than jumping straight to the full editor.


## Scope-type defaults

| Scope type | Suggested additional views |
|------------|---------------------------|
| Private | `wiki` (1 slot on free) |
| Standalone team | `kanban` |
| Org team | `kanban` + `calendar` (within tier limit) |

## Dependencies

- [07-individual-vs-team.md](07-individual-vs-team.md)
- [30-scope-settings-matrix.md](30-scope-settings-matrix.md)
- [implementation_plan/15-scopes-org-teams-settings.md](../implementation_plan/15-scopes-org-teams-settings.md)
