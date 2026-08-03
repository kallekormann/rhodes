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
| `kanban` | Kanban | basic | coming_soon | Task boards per project |
| `calendar` | Calendar | basic | coming_soon | Deadlines, publishing schedule |
| `gantt` | Gantt | pro | coming_soon | Long-form planning |
| `wiki` | Wiki / links | basic | coming_soon | Internal doc graph (M6) |
| `dashboard` | Dashboard | pro | coming_soon | Scope metrics |
| `graph` | Mind-map / dependencies | pro | coming_soon | Visualize `relation`-linked documents (M6) |

Tier limits (`maxAdditionalScopeViews`): free 1, basic 3, pro 5, team 5.

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
as a `dashboard` v2 concept once the `graph`/`relation` foundation and a real M6 rendering engine exist;
do not attempt to seed it as a bundle view preset yet.

## Template bundles (wizard pre-check)

When user selects additional views at scope creation, pre-select templates:

| View selection | Recommended templates |
|----------------|----------------------|
| `kanban` | Project kickoff, Sprint retro |
| `calendar` | Editorial calendar, Meeting notes |
| `gantt` | Product roadmap, Research plan |
| `wiki` | Knowledge base starter, Glossary |
| `dashboard` | Weekly status |

User can add/remove before create. System templates from seed migrations apply when `workspace_id` is null.

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
